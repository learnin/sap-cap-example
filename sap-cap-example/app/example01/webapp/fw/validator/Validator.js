sap.ui.define([
	"sap/m/Input",
	"sap/ui/base/Object",
	"sap/ui/core/message/ControlMessageProcessor",
	"sap/ui/core/message/Message",
	"sap/ui/core/LabelEnablement",
	"sap/ui/core/MessageType",
	"sap/ui/core/ValueState"
], function (
	Input,
	BaseObject,
	ControlMessageProcessor,
	Message,
	LabelEnablement,
	MessageType,
	ValueState) {
	"use strict";

	/**
	 * バリデータ。
	 * SAPUI5 の標準のバリデーションの仕組みは基本的にフォームフィールドの change イベントで実行されるため
	 * 必須フィールドに未入力のまま保存ボタン等を押された時にはバリデーションが実行されない。
	 * 本バリデータはそれに対応するためのもので、必須フィールドのバリデーションを行う。
	 * （必須チェック以外は標準の仕組みでカバーできるため本バリデータでは行わない）
	 *
	 * @class
	 */
	class Validator {
		/**
		 * @constructor
		 * @public
		 * @param {Object} mParameter
		 */
		constructor(mParameter) {
			this._aTargetAggregations = [
				"items",
				"content",
				"form",
				"formContainers",
				"formElements",
				"fields",
				"sections",
				"subSections",
				"_grid",
				"cells",
				"_page"
			];
			if (mParameter && mParameter.targetAggregations) {
				if (Array.isArray(mParameter.targetAggregations)) {
					mParameter.targetAggregations.forEach(sTargetAggregation => {
						if (!this._aTargetAggregations.includes(sTargetAggregation)) {
							this._aTargetAggregations.push(sTargetAggregation);
						}
					});
				} else {
					if (!this._aTargetAggregations.includes(mParameter.targetAggregations)) {
						this._aTargetAggregations.push(mParameter.targetAggregations);
					}
				}
			}

			// キーのコントロールIDのコントロールの検証後に実行する関数配列を保持するマップ。型は Map<string, Object[]>
			this._mValidateFunctionCalledAfterValidate = new Map();

			/**
			 * フォーカスアウト時のバリデーションのためのバリデータ関数の attach を重複して行わないように、コントロールに customData として追加するフラグのキー
			 **/
			// isRequired が true のコントロールに対して追加するキー
			this._CUSTOM_DATA_KEY_FOR_IS_ADDED_REQUIRED_VALIDATOR = "fw.validator.Validator.IS_ADDED_REQUIRED_VALIDATOR";
			// registerValidateFunctionCalledAfterValidate, registerRequiredValidateFunctionCalledAfterValidate の対象コントロールに対して追加するキー
			this._CUSTOM_DATA_KEY_FOR_IS_ADDED_REGISTERED_VALIDATOR = "fw.validator.Validator.IS_ADDED_REGISTERED_VALIDATOR";

			/**
			 * validate メソッド実行時に isRequired が true のコントロールおよび、
			 * registerValidateFunctionCalledAfterValidate, registerRequiredValidateFunctionCalledAfterValidate の対象コントロールに
			 * フォーカスアウト時のバリデーション関数を attach するか。
			 * 挙動としては以下のいずれかとなる。
			 * true （デフォルト）の場合：1度 validate するとフォーカスアウトでバリデーションが効くようになる
			 *                        （正しい値を入れてフォーカスアウトしてエラーが消えてもまた不正にしてフォーカスアウトするとエラーになる）
			 * false の場合：1度 validate すると removeErrors するまでエラーは残りっぱなしとなる
			 */
			this._useFocusoutValidation = true;
			if (mParameter && mParameter.useFocusoutValidation === false) {
				this._useFocusoutValidation = false;
			}
		}

		/**
		 * 引数のオブジェクトもしくはその配下のコントロールのバリデーションを行う。
		 *
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oControl 検証対象のコントロールもしくはそれを含むコンテナ
		 * @returns {boolean} true: valid、false: invalid
		 */
		validate(oControl) {
			if (this._useFocusoutValidation) {
				this._addValidator2Controls(oControl);
			}
			return this._validate(oControl);
		}

		/**
		 * 引数のオブジェクトもしくはその配下のコントロールについて、本クラスにより追加されたメッセージを
		 * {@link sap.ui.core.message.MessageManager MessageManager} から除去する。
		 * その結果、該当コントロールにメッセージがなくなった場合は、{@link sap.ui.core.ValueState ValueState} もクリアする。
		 *
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oControl 検証対象のコントロールもしくはそれを含むコンテナ
		 */
		removeErrors(oControl) {
			if (!(oControl instanceof sap.ui.core.Control ||
				oControl instanceof sap.ui.layout.form.FormContainer ||
				oControl instanceof sap.ui.layout.form.FormElement ||
				oControl instanceof sap.m.IconTabFilter)) {
				// バリデート時には isVisible() も条件としているが、remove 時には変わっている可能性もなくはないため、あえて条件に入れない。
				return;
			}
			this._removeMessagesAndValueStateIncludeChildren(oControl);
		}

		/**
		 * {@link #registerValidateFunctionCalledAfterValidate registerValidateFunctionCalledAfterValidate} の引数のコールバック関数の型
		 *
		 * @callback testFunction
		 * @param {sap.ui.core.Control} oControl 本関数が呼び出される直前に検証された（または検証をスキップされた）コントロール
		 * @returns {boolean} true: valid、false: invalid
		 */
		/**
		 * oControl の検証後に実行する関数を登録する。
		 * すでに oControl に sValidateFunctionId の関数が登録されている場合は関数を上書きする。
		 * 
		 * @param {string} sValidateFunctionId fnTest を識別するための任意のID
		 * @param {testFunction} fnTest oControl の検証後に実行される検証用の関数
		 * @param {string|string[]} sMessageTextOrAMessageTexts 検証エラーメッセージまたはその配列
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oTargetControlOrAControls 検証対象のコントロールまたはその配列
		 * @param {sap.ui.core.Control} oControl {@link #validate validate} 実行時に oControl の検証後に fnTest を使って検証を行う
		 * @param {Object} [mParameter] オプションパラメータ
		 * @returns {Validator} Reference to this in order to allow method chaining
		 */
		// oTargetControlOrAControls が配列で sMessageTextOrAMessageTexts も配列で要素数が同じはOK
		// oTargetControlOrAControls が配列で sMessageTextOrAMessageTexts がObjectもOK
		// oTargetControlOrAControls がObjectで sMessageTextOrAMessageTexts もObjectもOK
		registerValidateFunctionCalledAfterValidate(sValidateFunctionId, fnTest, sMessageTextOrAMessageTexts, oTargetControlOrAControls, oControl, mParameter) {
			if (!(
				(!Array.isArray(oTargetControlOrAControls) && !Array.isArray(sMessageTextOrAMessageTexts)) ||
				(Array.isArray(oTargetControlOrAControls) && !Array.isArray(sMessageTextOrAMessageTexts)) ||
				(Array.isArray(oTargetControlOrAControls) && Array.isArray(sMessageTextOrAMessageTexts) && sMessageTextOrAMessageTexts.length == oTargetControlOrAControls.length))) {
				throw new SyntaxError();
			}
			const oDefaultParam = {
				isAttachFocusoutValidationImmediately: true,
				isGroupedTargetControls: false
			};
			const oParam = { ...oDefaultParam, ...mParameter };

			const fnValidateFunction = oCtl => {
				if (fnTest(oCtl)) {
					// このバリデータ関数は validate メソッド実行時に呼ばれるものとなるので、エラーメッセージの除去やエラーステートの解除は不要。
					// （フォーカスアウト時のバリデータでは必要だが、それらは別途、_addValidator2Control 内でバリデータ関数が作成されて attach される）
					return true;
				}
				if (Array.isArray(oTargetControlOrAControls)) {
					if (oParam.isGroupedTargetControls) {
						const sMessageText = Array.isArray(sMessageTextOrAMessageTexts) ? sMessageTextOrAMessageTexts[0] : sMessageTextOrAMessageTexts;
						this._addMessage(oTargetControlOrAControls, sMessageText, sValidateFunctionId);
						
						for (let i = 0; i < oTargetControlOrAControls.length; i++) {
							this._setValueState(oTargetControlOrAControls[i], ValueState.Error, sMessageText);
						}
						return false;
					}

					for (let i = 0; i < oTargetControlOrAControls.length; i++) {
						const sMessageText = Array.isArray(sMessageTextOrAMessageTexts) ? sMessageTextOrAMessageTexts[i] : sMessageTextOrAMessageTexts;
						this._addMessage(oTargetControlOrAControls[i], sMessageText, sValidateFunctionId);
						this._setValueState(oTargetControlOrAControls[i], ValueState.Error, sMessageText);
					}
				} else {
					this._addMessage(oTargetControlOrAControls, sMessageTextOrAMessageTexts, sValidateFunctionId);
					this._setValueState(oTargetControlOrAControls, ValueState.Error, sMessageTextOrAMessageTexts);
				}
				return false;
			};

			const sControlId = oControl.getId();

			if (this._mValidateFunctionCalledAfterValidate.has(sControlId)) {
				const aValidateFunctions = this._mValidateFunctionCalledAfterValidate.get(sControlId);
				const oValidateFunction = aValidateFunctions.find(oValidateFunction => oValidateFunction.validateFunctionId === sValidateFunctionId);
				if (oValidateFunction) {
					oValidateFunction.testFunction = fnTest;
					oValidateFunction.messageTextOrMessageTexts = sMessageTextOrAMessageTexts;
					oValidateFunction.targetControlOrControls = oTargetControlOrAControls;
					oValidateFunction.validateFunction = fnValidateFunction;
					oValidateFunction.isGroupedTargetControls = oParam.isGroupedTargetControls;
				} else {
					aValidateFunctions.push({
						validateFunctionId: sValidateFunctionId,
						testFunction: fnTest,
						messageTextOrMessageTexts: sMessageTextOrAMessageTexts,
						targetControlOrControls: oTargetControlOrAControls,
						validateFunction: fnValidateFunction,
						isGroupedTargetControls: oParam.isGroupedTargetControls
					});
				}
			} else {
				this._mValidateFunctionCalledAfterValidate.set(sControlId, [{
					validateFunctionId: sValidateFunctionId,
					testFunction: fnTest,
					messageTextOrMessageTexts: sMessageTextOrAMessageTexts,
					targetControlOrControls: oTargetControlOrAControls,
					validateFunction: fnValidateFunction,
					isGroupedTargetControls: oParam.isGroupedTargetControls
				}]);
			}
			
			if (oParam.isAttachFocusoutValidationImmediately) {
				this._addValidator2Control(oTargetControlOrAControls, fnTest, sMessageTextOrAMessageTexts, sValidateFunctionId, oParam.isGroupedTargetControls);
			}
			return this;
		}

		registerRequiredValidateFunctionCalledAfterValidate(sValidateFunctionId, fnTest, oTargetControlOrAControls, oControl, mParameter) {
			const oDefaultParam = {
				isAttachFocusoutValidationImmediately: false,
				// isGroupedTargetControls: true の場合、oTargetControlOrAControls を1つのグループとみなして検証は1回だけ（コントロール数分ではない）で、エラーメッセージも1つだけで、
				// エラーステートは全部のコントロールにつくかつかないか（一部だけつくことはない）
				isGroupedTargetControls: false
			};
			const oParam = { ...oDefaultParam, ...mParameter };

			let sMessageTextOrAMessageTexts;
			if (Array.isArray(oTargetControlOrAControls)) {
				if (oParam.isGroupedTargetControls) {
					sMessageTextOrAMessageTexts = this._getRequiredErrorMessageTextByControl(oTargetControlOrAControls[0]);
				} else {
					sMessageTextOrAMessageTexts = oTargetControlOrAControls.map(oTargetControl => this._getRequiredErrorMessageTextByControl(oTargetControl));
				}
			} else {
				sMessageTextOrAMessageTexts = this._getRequiredErrorMessageTextByControl(oTargetControlOrAControls);
			}
			this.registerValidateFunctionCalledAfterValidate(sValidateFunctionId, fnTest, sMessageTextOrAMessageTexts, oTargetControlOrAControls, oControl, oParam);
			return this;
		}

		/**
		 * oControl の検証後に実行するように登録されている関数を登録解除する。
		 * 
		 * @param {string} sValidateFunctionId validateFunction を識別するための任意のID
		 * @param {sap.ui.core.Control} oControl コントロール
		 * @returns {Validator} Reference to this in order to allow method chaining
		 */
		unregisterValidateFunctionCalledAfterValidate(sValidateFunctionId, oControl) {
			const sControlId = oControl.getId();
			if (!this._mValidateFunctionCalledAfterValidate.has(sControlId)) {
				return this;
			}
			const aValidateFunctions = this._mValidateFunctionCalledAfterValidate.get(sControlId);
			const iIndex = aValidateFunctions.findIndex(oValidateFunction => oValidateFunction.validateFunctionId === sValidateFunctionId);
			if (iIndex >= 0) {
				aValidateFunctions.splice(iIndex, 1);
			}
			if (aValidateFunctions.length === 0) {
				this._mValidateFunctionCalledAfterValidate.delete(sControlId);
			}
			return this;
		}

		_addValidator2Controls(oControl) {
			// 非表示のコントロールも後で表示される可能性が想定されるため、処理対象とする
			if (!(oControl instanceof sap.ui.core.Control ||
				oControl instanceof sap.ui.layout.form.FormContainer ||
				oControl instanceof sap.ui.layout.form.FormElement ||
				oControl instanceof sap.m.IconTabFilter)) {
				return;
			}

			// sap.ui.core.LabelEnablement#isRequired は対象コントロール・エレメント自体の required 属性だけでなく、
		    // labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label の required 属性まで見て判断してくれる。
			// （なお、ariaLabelledBy で参照される Label までは見てくれない）
			// disable のコントロールも後で有効化される可能性が想定されるため、処理対象とする
			if (LabelEnablement.isRequired(oControl)) {
				this._addRequiredValidator2Control(oControl);
			}
			if (this._mValidateFunctionCalledAfterValidate.has(oControl.getId())) {
				this._mValidateFunctionCalledAfterValidate.get(oControl.getId()).forEach(oValidateFunction => {
					this._addValidator2Control(
						oValidateFunction.targetControlOrControls,
						oValidateFunction.testFunction,
						oValidateFunction.messageTextOrMessageTexts,
						oValidateFunction.validateFunctionId,
						oValidateFunction.isGroupedTargetControls);
				});
			}
			// 入力コントロールやエレメントでなかった場合は、aggregation のコントロールやエレメントを再帰的に検証する。
			for (let i = 0; i < this._aTargetAggregations.length; i++) {
				const aControlAggregation = oControl.getAggregation(this._aTargetAggregations[i]);
				if (!aControlAggregation) {
					continue;
				}
				if (Array.isArray(aControlAggregation)) {
					for (let j = 0; j < aControlAggregation.length; j++) {
						this._addValidator2Controls(aControlAggregation[j]);
					}
				} else {
					this._addValidator2Controls(aControlAggregation);
				}
			}
		}

		/**
		 * 引数のオブジェクトとその配下のコントロールのバリデーションを行う。
		 *
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oControl 検証対象のコントロールもしくはそれを含むコンテナ
		 * @returns {boolean}　true: valid、false: invalid
		 */
		_validate(oControl) {
			let isValid = true;

			if (!((oControl instanceof sap.ui.core.Control ||
				oControl instanceof sap.ui.layout.form.FormContainer ||
				oControl instanceof sap.ui.layout.form.FormElement ||
				oControl instanceof sap.m.IconTabFilter) &&
				oControl.getVisible())) {
				
				if (this._mValidateFunctionCalledAfterValidate.has(oControl.getId())) {
					this._mValidateFunctionCalledAfterValidate.get(oControl.getId()).forEach(oValidateFunction => {
						if (!oValidateFunction.validateFunction(oControl)) {
							isValid = false;
						}
					});
				}
				return isValid;
			}

			// sap.ui.core.LabelEnablement#isRequired は対象コントロール・エレメント自体の required 属性だけでなく、
		    // labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label の required 属性まで見て判断してくれる。
			// （なお、ariaLabelledBy で参照される Label までは見てくれない）
			if (((oControl.getEnabled && oControl.getEnabled()) || !oControl.getEnabled) &&
				LabelEnablement.isRequired(oControl)) {
				isValid = this._validateRequired(oControl);
			}
			// 入力コントロールやエレメントでなかった場合は、aggregation のコントロールやエレメントを再帰的に検証する。
			for (let i = 0; i < this._aTargetAggregations.length; i++) {
				const aControlAggregation = oControl.getAggregation(this._aTargetAggregations[i]);
				if (!aControlAggregation) {
					continue;
				}
				if (Array.isArray(aControlAggregation)) {
					for (let j = 0; j < aControlAggregation.length; j++) {
						if (!this._validate(aControlAggregation[j])) {
							isValid = false;
						}
					}
				} else {
					if (!this._validate(aControlAggregation)) {
						isValid = false;
					}
				}
			}
			if (this._mValidateFunctionCalledAfterValidate.has(oControl.getId())) {
				this._mValidateFunctionCalledAfterValidate.get(oControl.getId()).forEach(oValidateFunction => {
					if (!oValidateFunction.validateFunction(oControl)) {
						isValid = false;
					}
				});
			}
			return isValid;
		}

		_addRequiredValidator2Control(oControl) {
			if (!oControl.attachSelectionFinish && !oControl.attachChange && !oControl.attachSelect) {
				// 対象外
				return;
			}
			if (this._isAddedRequiredValidator2Control(oControl)) {
				return;
			}
			const sMessageText = this._getRequiredErrorMessageTextByControl(oControl);
			const fnRequiredValidator = oEvent => {
				if (this._isNullValue(oControl)) {
					this._addMessage(oControl, sMessageText);
					this._setValueState(oControl, ValueState.Error, sMessageText);
				} else {
					this._removeMessageAndValueState(oControl);
				}
			};
			if (oControl.attachSelectionFinish) {
				oControl.attachSelectionFinish(fnRequiredValidator);
				this._markedAddedRequiredValidator2Control(oControl);
			} else if (oControl.attachChange) {
				oControl.attachChange(fnRequiredValidator);
				this._markedAddedRequiredValidator2Control(oControl);
			} else if (oControl.attachSelect) {
				oControl.attachSelect(fnRequiredValidator);
				this._markedAddedRequiredValidator2Control(oControl);
			}
		}

		_isAddedRequiredValidator2Control(oControl) {
			return oControl.data(this._CUSTOM_DATA_KEY_FOR_IS_ADDED_REQUIRED_VALIDATOR) === "true";
		}

		_markedAddedRequiredValidator2Control(oControl) {
			oControl.data(this._CUSTOM_DATA_KEY_FOR_IS_ADDED_REQUIRED_VALIDATOR, "true");
		}

		_addValidator2Control(oControlOrAControls, fnTest, sMessageTextOrAMessageTexts, sValidateFunctionId, isGroupedTargetControls) {
			let aControls;
			if (!Array.isArray(oControlOrAControls)) {
				aControls = [oControlOrAControls];
			} else if (oControlOrAControls.length === 0) {
				return;
			} else {
				aControls = oControlOrAControls;
			}

			for (let i = 0; i < aControls.length; i++) {
				const oControl = aControls[i];

				if (this._isAddedValidator2Control(oControl)) {
					continue;
				}
				const fnValidator = oEvent => {
					if (fnTest(oControl)) {
						aControls.forEach(oCtl => {
							// 例えば、日付の大小関係チェックのように、自身以外のコントロールの値が修正されてフォーカスアウトしたことで、自身も正常となるので対象コントロール達のエラーは解除する。
							this._removeMessageAndValueState(oCtl, sValidateFunctionId);
						});
					} else {
						if (isGroupedTargetControls) {
							const sMessageText = Array.isArray(sMessageTextOrAMessageTexts) ? sMessageTextOrAMessageTexts[0] : sMessageTextOrAMessageTexts;
							// TODO: この oControl は aControls にすべきか？
							this._addMessage(oControl, sMessageText, sValidateFunctionId);
							
							aControls.forEach(oCtl => {
								this._setValueState(oCtl, ValueState.Error, sMessageText);
							});
						} else {
							const sMessageText = Array.isArray(sMessageTextOrAMessageTexts) ? sMessageTextOrAMessageTexts[i] : sMessageTextOrAMessageTexts;
							this._addMessage(oControl, sMessageText, sValidateFunctionId);
							this._setValueState(oControl, ValueState.Error, sMessageText);
						}
					}
				};
				if (oControl.attachSelectionFinish) {
					oControl.attachSelectionFinish(fnValidator);
					this._markedAddedValidator2Control(oControl);
				} else if (oControl.attachChange) {
					oControl.attachChange(fnValidator);
					this._markedAddedValidator2Control(oControl);
				} else if (oControl.attachSelect) {
					oControl.attachSelect(fnValidator);
					this._markedAddedValidator2Control(oControl);
				}
			}
		}

		_isAddedValidator2Control(oControl) {
			return oControl.data(this._CUSTOM_DATA_KEY_FOR_IS_ADDED_REGISTERED_VALIDATOR) === "true";
		}

		_markedAddedValidator2Control(oControl) {
			oControl.data(this._CUSTOM_DATA_KEY_FOR_IS_ADDED_REGISTERED_VALIDATOR, "true");
		}

		/**
		 * 引数のコントロールの必須チェックを行う。
		 *
		 * @param {sap.ui.core.Control} oControl 検証対象のコントロール
		 * @returns {boolean}　true: valid、false: invalid
		 */
		_validateRequired(oControl) {
			if (!this._isNullValue(oControl)) {
				return true;
			}
			const sMessageText = this._getRequiredErrorMessageTextByControl(oControl);
			this._addMessage(oControl, sMessageText);
			this._setValueState(oControl, ValueState.Error, sMessageText);
			return false;
		}

		_removeMessagesAndValueStateIncludeChildren(oTargetRootControl) {
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const sValidatorMessageName = _ValidatorMessage.getMetadata().getName();
			const aMessagesAddedByThisValidator = oMessageModel.getProperty("/")
				.filter(oMessage => BaseObject.isA(oMessage, sValidatorMessageName));

			for (let i = 0, n = aMessagesAddedByThisValidator.length; i < n; i++) {
				const oMessage = aMessagesAddedByThisValidator[i];
				const oControl = sap.ui.getCore().byId(oMessage.getValidationErrorControlId());
				if (!oControl) {
					// 対象のコントロールがない場合はメッセージも削除する。
					oMessageManager.removeMessages(oMessage);
					continue;
				}
				if (!oTargetRootControl || this._isChildOrEqualControlId(oControl, oTargetRootControl)) {
					oMessageManager.removeMessages(oMessage);
					this._clearValueStateIfNoErrors(oControl, oMessage.getTarget())
				}
			}
		}

		_removeMessageAndValueState(oControl, sValidateFunctionId) {
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const sValidatorMessageName = _ValidatorMessage.getMetadata().getName();
			const sControlId = oControl.getId();

			const oMessage = oMessageModel.getProperty("/").find(oMsg =>
				BaseObject.isA(oMsg, sValidatorMessageName) &&
				oMsg.getValidationErrorControlId() === sControlId &&
				oMsg.getValidateFunctionId() === sValidateFunctionId);
			if (oMessage) {
				oMessageManager.removeMessages(oMessage);
			}
			this._clearValueStateIfNoErrors(oControl, this._resolveMessageTarget(oControl))
		}

		/**
		 * 不正な値を入力された場合、標準のバリデーションによりエラーステートがセットされている可能性があるため、
		 * 該当のコントロールにエラーメッセージがまだあるか確認し、ない場合にのみエラーステートをクリアする。
		 * 
		 * @param {sap.ui.core.Control} oControl 処理対象のコントロール
		 * @param {string} sTarget セットされているメッセージの中から対象のコントロールのメッセージを判別するための Message の target プロパティ値
		 */
		_clearValueStateIfNoErrors(oControl, sTarget) {
			// TODO: getTarget を getTargets にすべき箇所を検討して変更する。
			// ここのgetTargetは変更せず、呼び出し元を変更し、sTargetが配列の場合はその1つ１つについて判定してsetValueStateするのをループさせるのが正しそう。
			if (oControl.setValueState &&
				!sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/").find(oMsg => oMsg.getTarget() === sTarget)) {
				this._setValueState(oControl, ValueState.None, null);
			}
		}

		_isChildOrEqualControlId(oControl, oParentControl) {
			const sParentControlId = oParentControl.getId();
			if (oControl.getId() === sParentControlId) {
				return true;
			}
			let oTargetControl = oControl;

			while (oTargetControl.getParent()) {
				if (oTargetControl.getParent().getId() === sParentControlId) {
					return true;
				}
				oTargetControl = oTargetControl.getParent();
			}
			return false;
		}

		_resolveMessageTarget(oControlOrAControls) {
			let aControls = [];
			if (Array.isArray(oControlOrAControls)) {
				aControls = oControlOrAControls;
			} else {
				aControls.push(oControlOrAControls);
			}
			const aTargets = aControls.map(oControl => {
				if (oControl.getBinding("value") || oControl.getValue) {
					return oControl.getId() + "/value";
				}
				if (oControl.getBinding("selectedKey") || oControl.getSelectedKey) {
					return oControl.getId() + "/selectedKey";
				}
				if (oControl.getBinding("selectedKeys") || oControl.getSelectedKeys) {
					return oControl.getId() + "/selectedKeys";
				}
				if (oControl.getBinding("selected") || oControl.getSelected) {
					return oControl.getId() + "/selected";
				}
				if (oControl.getBinding("selectedIndex") || oControl.getSelectedIndex) {
					return oControl.getId() + "/selectedIndex";
				}
				if (oControl.getBinding("selectedDates") || oControl.getSelectedDates) {
					return oControl.getId() + "/selectedDates";
				}
				return undefined;
			});
			if (aTargets.length > 0) {
				return aTargets;
			}
			return aTargets[0];
		}

		/**
		 * 
		 * @param {sap.ui.core.Control} oControl 検証対象のコントロール
		 * @returns {boolean}
		 */
		_isNullValue(oControl) {
			if (!oControl.getValue &&
				!oControl.getSelectedKey &&
				!oControl.getSelectedKeys &&
				!oControl.getSelected &&
				!oControl.getSelectedIndex &&
				!oControl.getSelectedDates) {
				// バリデーション対象外
				return false;
			}
			// 例えば sap.m.ComboBox は getValue も getSelectedKey もあるが、選択肢から選ばずに直接値を入力した際は getSelectedKey は空文字になるので getValue で判定する必要がある。
			// このため、いずれかの値を取得するメソッドの戻り値に値が入っていれば、入力されていると判断する。
			// ただし、getSelectedIndex もあり、例えば1つ目の選択肢が「選択してください」だったとしてそれを選択していた場合、getSelectedIndex は0を返すため、
			// プルダウンフィールドは getSelectedIndex では判定できないため getSelectedIndex はみない。
			// sap.m.MultiComboBox は getValue も getSelectedKeys もあるが、getValue では値は取得できないので getSelectedKeys で判定する必要がある。
			if (oControl.getValue || oControl.getSelectedKey || oControl.getSelectedKeys || oControl.getSelected) {
				return !((oControl.getValue && oControl.getValue()) ||
					(oControl.getSelectedKey && oControl.getSelectedKey()) ||
					(oControl.getSelectedKeys && oControl.getSelectedKeys().length > 0) ||
					(oControl.getSelected && oControl.getSelected()));
			}
			if (oControl.getSelectedIndex && oControl.getSelectedIndex() >= 0) {
				// TODO: sap.m.RadioButtonGroupでselectedIndex のバインド値が null や undefined の場合 getSelectedIndex() は 0となる。
				// また、選択肢に存在しない正数値の場合はその値になるので何らかの対応が必要
				return false;
			}
			if (oControl.getSelectedDates) {
				const aSelectedDates = oControl.getSelectedDates();
				if (aSelectedDates.length > 0 && aSelectedDates[0].getStartDate()) {
					return false;
				}
			}
			return true;
		}

		_getRequiredErrorMessageTextByControl(oControl) {
			if (oControl instanceof Input) {
				// sap.m.Input には getValue も getSelectedKey もあるので個別に判定する。
				// TODO: i18n
				return "Required to input.";
			}
			if (oControl.getSelectedKey ||
				oControl.getSelectedKeys ||
				oControl.getSelected ||
				oControl.getSelectedIndex ||
				oControl.getSelectedDates) {
				// TODO: i18n
				return "Required to select.";
			}
			// TODO: i18n
			return "Required to input.";
		}

		/**
		 * sap.ui.core.LabelEnablement#getReferencingLabels は
		 * labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label まで取得してくれる。
		 * （なお、ariaLabelledBy で参照される Label までは取得してくれない）
		 * 試した結果は以下の通り。
		 * - SimpleForm内で、labelForなし											ラベルID取得OK
		 * - SimpleForm外で、labelForあり											ラベルID取得OK
		 * - SimpleForm外で、labelForなし、入力コントロール側にariaLabelledByあり		ラベルID取得NG（ariaLabelledByまでは見に行かない）
		 * - SimpleForm外で、labelForなし、入力コントロール側にariaLabelledByなし		ラベルID取得NG（紐付ける手がかりが一切ないので当たり前）
		 */
		_getLabelText(oControl) {
			// sap.m.CheckBox の場合、そのまま LabelEnablement.getReferencingLabels を取得すると各チェックボックスのラベルが取得されるので、
			// 親のコントロールのラベルを探してみる。（親のラベルが見つかるかはビューの構造による。例えば、SimpleForm 内では見つからない）
			if (oControl instanceof sap.m.CheckBox && oControl.getParent()) {
				const aLabelId = LabelEnablement.getReferencingLabels(oControl.getParent());
				if (aLabelId && aLabelId.length > 0) {
					const oLabel = sap.ui.getCore().byId(aLabelId[0]);
					if (oLabel && oLabel.getText) {
						return oLabel.getText();
					}
				}
			}
			const aLabelId = LabelEnablement.getReferencingLabels(oControl);
			if (aLabelId && aLabelId.length > 0) {
				const oLabel = sap.ui.getCore().byId(aLabelId[0]);
				if (oLabel && oLabel.getText) {
					return oLabel.getText();
				}
			}
			return undefined;
		}

		/**
		 * {@link sap.ui.core.message.MessageManager MessageManager} にメッセージを追加する。
		 *
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oControlOrAControls 検証エラーとなったコントロール
		 * @param {string} sMessageText エラーメッセージ
		 * @param {string} [sValidateFunctionId] 検証を行った関数のID。this._mValidateFunctionCalledAfterValidate に含まれる関数で検証した場合にのみ必要
		 */
		_addMessage(oControlOrAControls, sMessageText, sValidateFunctionId) {
			let oControl = oControlOrAControls;
			if (Array.isArray(oControlOrAControls)) {
				oControl = oControlOrAControls[0];
			}
			sap.ui.getCore().getMessageManager().addMessages(new _ValidatorMessage({
				message: sMessageText,
				type: MessageType.Error,
				additionalText: this._getLabelText(oControl),
				processor: new ControlMessageProcessor(),
				target: this._resolveMessageTarget(oControlOrAControls),
				validationErrorControlId: oControl.getId(),
				validateFunctionId: sValidateFunctionId
			}));
		}

		/**
		 * 引数のコントロールに {@link sap.ui.core.ValueState ValueState} と ValueStateText をセットする。
		 *
		 * @param {sap.ui.core.Control} oControl セット先のコントロール
		 * @param {sap.ui.core.ValueState} oValueState セットするステート
		 * @param {string} sText セットするステートテキスト
		 */
		_setValueState(oControl, oValueState, sText) {
			if (oControl.setValueState) {
				oControl.setValueState(oValueState);
			}
			if (oControl.setValueStateText) {
				oControl.setValueStateText(sText);
			}
		}
	}

	/**
	 * 本 Validator で MseesageManager からメッセージを削除する際に、
	 * 本 Validator で追加したメッセージを型で判別可能とするためのメッセージ。
	 * 
	 * @class
	 * @private
	 */
	const _ValidatorMessage = Message.extend("fw.validator.Validator._ValidatorMessage", {
		constructor: function (mParameters) {
			if (mParameters && Array.isArray(mParameters.target)) {
				if (!Message.prototype.getTargets) {
					// Message の target の配列サポートは UI5 1.79からなので、getTargets メソッドがない場合は、独自に配列を保持する。
					this.targets = mParameters.target;
					if (mParameters.target.length > 0) {
						mParameters.target = mParameters.target[0];
					} else {
						delete mParameters.target;
					}
					Message.call(this, mParameters);
				} else {
					Message.call(this, mParameters);
				}
			} else {
				Message.call(this, mParameters);
			}
			
			if (mParameters && mParameters.validationErrorControlId) {
				this.validationErrorControlId = mParameters.validationErrorControlId;

				// https://sapui5.hana.ondemand.com/#/api/sap.ui.core.message.Message/methods/getControlId に InputBase のコントロールにしか
				// controlIdはセットされないと書かれている。実際に、例えば RadioButton ではセットされない。なぜ、こういう仕様にしているのかは不明。
				// 本メッセージクラスではコントロールに関わらずセットする（ただし、何らかの問題が見つかった場合はセットするのをやめる可能性あり）。
				this.addControlId(mParameters.validationErrorControlId);
			}
			if (mParameters && mParameters.validateFunctionId) {
				this.validateFunctionId = mParameters.validateFunctionId;
			}
		}
	});
	_ValidatorMessage.prototype.getTargets = function() {
		if (Message.prototype.getTargets) {
			return Message.prototype.getTargets.call(this);
		}
		return this.targets;
	};
	_ValidatorMessage.prototype.getValidationErrorControlId = function() {
		return this.validationErrorControlId;
	};
	_ValidatorMessage.prototype.getValidateFunctionId = function() {
		return this.validateFunctionId;
	};

	return Validator;
});
