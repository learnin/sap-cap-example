sap.ui.define([
	"sap/base/util/uid",
	"sap/m/CheckBox",
	"sap/m/ColumnListItem",
	"sap/m/IconTabFilter",
	"sap/m/Input",
	"sap/m/Table",
	"sap/ui/base/Object",
	"sap/ui/core/Control",
	"sap/ui/core/Element",
	"sap/ui/core/LabelEnablement",
	"sap/ui/core/MessageType",
	"sap/ui/core/ValueState",
	"sap/ui/core/message/ControlMessageProcessor",
	"sap/ui/core/message/Message",
	"sap/ui/layout/form/FormContainer",
	"sap/ui/layout/form/FormElement",
	"sap/ui/table/Row",
	"sap/ui/table/Table"
], function (
	uid,
	CheckBox,
	ColumnListItem,
	IconTabFilter,
	Input,
	sapMTable,
	BaseObject,
	Control,
	Element,
	LabelEnablement,
	MessageType,
	ValueState,
	ControlMessageProcessor,
	Message,
	FormContainer,
	FormElement,
	sapUiTableRow,
	sapUiTableTable) {
	"use strict";

	/**
	 * バリデータ。
	 * SAPUI5 の標準のバリデーションの仕組みは基本的にフォームフィールドの change 等のイベントで実行されるため
	 * 必須フィールドに未入力のまま保存ボタン等を押された時にはバリデーションが実行されない。
	 * 本バリデータはそれに対応するためのもので、必須フィールドのバリデーションや相関バリデーション等の独自バリデーションを行うための機能を提供する。
	 *
	 * @public
	 * @class
	 */
	class Validator {
		/**
		 * コンストラクタのオプションパラメータ
		 * 
		 * @typedef {Object} Validator~Parameter
		 * @property {sap.base.i18n.ResourceBundle} resourceBundle i18n リソースバンドルクラス
		 * @property {string|string[]} targetAggregations バリデーション対象として追加する、コントロールの aggregation 名
		 * @property {boolean} useFocusoutValidation validate メソッド実行時に isRequired が true のコントロールおよび、registerValidator, registerRequiredValidator の対象コントロールに
		 * 		フォーカスアウト時のバリデーション関数を attach するか。
		 * 		挙動としては以下のいずれかとなる。
		 * 		true （デフォルト）の場合：1度 validate するとフォーカスアウトでバリデーションが効くようになる（正しい値を入れてフォーカスアウトしてエラーが消えてもまた不正にしてフォーカスアウトするとエラーになる）
		 * 		false の場合：1度 validate すると removeErrors するまでエラーは残りっぱなしとなる
		 * 		ただし、registerValidator, registerRequiredValidator が isAttachFocusoutValidationImmediately: true で実行された場合にはそのバリデーション関数は
		 * 		useFocusoutValidation の値には関係なく attach される。
		 */
		/**
		 * @constructor
		 * @public
		 * @param {Validator~Parameter} [mParameter] パラメータ
		 */
		constructor(mParameter) {
			
			/**
			 * 入力コントロールの必須バリデーションエラーメッセージのリソースバンドルキー
			 * 
			 * @public
			 */
			this.RESOURCE_BUNDLE_KEY_REQUIRED_INPUT = "fw.validator.Validator.message.requiredInput";
			/**
			 * 選択コントロールの必須バリデーションエラーメッセージのリソースバンドルキー
			 * 
			 * @public
			 */
			this.RESOURCE_BUNDLE_KEY_REQUIRED_SELECT = "fw.validator.Validator.message.requiredSelect";

			/**
			 * バリデーションエラーにより ValueState.Error をセットされたコントロールに付加する customData 属性のキー
			 * 
			 * @private
			 */
			this._CUSTOM_DATA_KEY_FOR_IS_SET_VALUE_STATE_ERROR = "fw.validator.Validator.IS_SET_VALUE_STATE_ERROR";

			// バリデーション対象とするコントロールの aggregation 名
			this._aTargetAggregations = [
				"items",
				"content",
				"form",
				"formContainers",
				"formElements",
				"fields",
				"sections",
				"subSections",
				"app",
				"pages",
				"_grid",
				"_page",
				"cells"		// sap.m.Table -> items -> cells
			];

			// {@link #registerValidator registerValidator} {@link #registerRequiredValidator registerRequiredValidator} で登録されたバリデータ関数情報オブジェクト配列を保持するマップ。
			// 型は Map<string, Object[]>
			this._mRegisteredValidator = new Map();

			// フォーカスアウト時のバリデーション関数が attach されたコントロールIDを保持するマップ。型は Map<String, Object>
			this._mControlIdAttachedValidator = new Map();

			if (mParameter && mParameter.resourceBundle) {
				this._resourceBundle = mParameter.resourceBundle;
			}

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

			this._useFocusoutValidation = true;
			if (mParameter && mParameter.useFocusoutValidation === false) {
				this._useFocusoutValidation = false;
			}
		}

		/**
		 * 引数のオブジェクトもしくはその配下のコントロールのバリデーションを行う。
		 *
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oTargetRootControl 検証対象のコントロールもしくはそれを含むコンテナ
		 * @returns {boolean} true: valid, false: invalid
		 */
		validate(oTargetRootControl) {
			if (this._useFocusoutValidation) {
				this._attachValidator(oTargetRootControl);
			}
			return this._validate(oTargetRootControl);
		}

		/**
		 * 引数のオブジェクトもしくはその配下のコントロールについて、本クラスにより追加されたメッセージを
		 * {@link sap.ui.core.message.MessageManager MessageManager} から除去する。
		 * その結果、該当コントロールにメッセージがなくなった場合は、{@link sap.ui.core.ValueState ValueState} もクリアする。
		 *
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oTargetRootControl 検証対象のコントロールもしくはそれを含むコンテナ
		 */
		removeErrors(oTargetRootControl) {
			if (!oTargetRootControl) {
				throw new SyntaxError();
			}
			if (!oTargetRootControl instanceof Control &&
				!oTargetRootControl instanceof FormContainer &&
				!oTargetRootControl instanceof FormElement &&
				!oTargetRootControl instanceof IconTabFilter) {
				// バリデート時には isVisible() も条件としているが、remove 時には変わっている可能性もなくはないため、あえて条件に入れない。
				return;
			}
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const sValidatorMessageName = _ValidatorMessage.getMetadata().getName();
			const aMessagesAddedByThisValidator = oMessageModel.getProperty("/")
				.filter(oMessage => BaseObject.isA(oMessage, sValidatorMessageName));
			const sTargetRootControlId = oTargetRootControl.getId();

			for (let i = 0, n = aMessagesAddedByThisValidator.length; i < n; i++) {
				const oMessage = aMessagesAddedByThisValidator[i];
				const aControlIds = oMessage.getValidationErrorControlIds();

				if (!aControlIds.some(sControlId => Element.registry.get(sControlId))) {
					// 対象のコントロールが1つもない場合はメッセージも削除する。
					oMessageManager.removeMessages(oMessage);
					continue;
				}
				aControlIds.forEach(sControlId => {
					const oControl = Element.registry.get(sControlId);
					if (this._isChildOrEqualControlId(oControl, sTargetRootControlId)) {
						oMessageManager.removeMessages(oMessage);
					}
				});
			}

			// TODO: Element.registry は他のビューの Element も含めて保持しているので画面数が多いアプリだとそれだけ遅くなるはずなので、
			// oTargetRootControl から配下の Element を全部見ていった方がベターと思われる。
			Element.registry.forEach((oElement, sId) => {
				if (this._isSetValueStateError(oElement)) {
					if (this._isChildOrEqualControlId(oElement, sTargetRootControlId)) {
						this._clearValueStateIfNoErrors(oElement, this._resolveMessageTarget(oElement));
					}
				}
			});
		}

		/**
		 * 引数のオブジェクトもしくはその配下のコントロールについて、本クラスにより attach されたバリデータ関数を detach する。
		 * 
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oTargetRootControl 対象のコントロールもしくはそれを含むコンテナ
		 */
		removeAttachedValidators(oTargetRootControl) {
			if (!oTargetRootControl) {
				throw new SyntaxError();
			}
			if (!oTargetRootControl instanceof Control &&
				!oTargetRootControl instanceof FormContainer &&
				!oTargetRootControl instanceof FormElement &&
				!oTargetRootControl instanceof IconTabFilter) {
				return;
			}
			const sTargetRootControlId = oTargetRootControl.getId();

			this._mControlIdAttachedValidator.forEach((oValidatorType, sControlId) => {
				const oControl = Element.registry.get(sControlId);
				if (!oControl) {
					return;
				}
				if (this._isChildOrEqualControlId(oControl, sTargetRootControlId)) {
					if (oValidatorType.registered) {
						this._detachRegisteredValidator(oControl);
					}
					if (oValidatorType.notRegistered) {
						this._detachNotRegisteredValidator(oControl);
					}
				}
			});
		}

		/**
		 * {@link #registerValidator registerValidator} {@link #registerRequiredValidator registerRequiredValidator} の引数のコールバック関数の型
		 *
		 * @public
		 * @callback testFunction
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oTargetControlOrAControls 検証対象のコントロールまたはその配列
		 * @returns {boolean} true: valid、false: invalid
		 */
		/**
		 * oControlValidateBefore の検証後に実行する関数を登録する。
		 * すでに oControlValidateBefore に sValidateFunctionId の関数が登録されている場合は関数を上書きする。
		 * 
		 * @public
		 * @param {string} [sValidateFunctionId] fnTest を識別するための任意のID。省略時は自動生成される
		 * @param {testFunction} fnTest oControlValidateBefore の検証後に実行される検証用の関数
		 * @param {string|string[]} sMessageTextOrAMessageTexts 検証エラーメッセージまたはその配列
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oTargetControlOrAControls 検証対象のコントロールまたはその配列
		 * @param {sap.ui.core.Control} oControlValidateBefore {@link #validate validate} oControlValidateBefore の検証後に fnTest が実行される。fnTest の実行順を指定するためのもの
		 * @param {Object} [mParameter] オプションパラメータ
		 * @returns {Validator} Reference to this in order to allow method chaining
		 */
		// oTargetControlOrAControls が配列で sMessageTextOrAMessageTexts も配列で要素数が同じはOK
		// oTargetControlOrAControls が配列で sMessageTextOrAMessageTexts がObjectもOK
		// oTargetControlOrAControls がObjectで sMessageTextOrAMessageTexts もObjectもOK
		registerValidator(sValidateFunctionId, fnTest, sMessageTextOrAMessageTexts, oTargetControlOrAControls, oControlValidateBefore, mParameter) {
			let isOriginalFunctionIdUndefined = false;
			if (typeof sValidateFunctionId !== 'string') {
				// sValidateFunctionId 省略時は ID を自動生成する。
				mParameter = oControlValidateBefore;
				oControlValidateBefore = oTargetControlOrAControls;
				oTargetControlOrAControls = sMessageTextOrAMessageTexts;
				sMessageTextOrAMessageTexts = fnTest;
				fnTest = sValidateFunctionId;
				sValidateFunctionId = uid();
				isOriginalFunctionIdUndefined = true;
			}
			if (!(
				(!Array.isArray(oTargetControlOrAControls) && !Array.isArray(sMessageTextOrAMessageTexts)) ||
				(Array.isArray(oTargetControlOrAControls) && !Array.isArray(sMessageTextOrAMessageTexts)) ||
				(Array.isArray(oTargetControlOrAControls) && Array.isArray(sMessageTextOrAMessageTexts) && sMessageTextOrAMessageTexts.length == oTargetControlOrAControls.length))) {
				throw new SyntaxError();
			}
			if (Array.isArray(oTargetControlOrAControls) && mParameter && mParameter.controlsMoreAttachValidator) {
				throw new SyntaxError();
			}

			const oDefaultParam = {
				isAttachFocusoutValidationImmediately: true,
				isGroupedTargetControls: false,
				controlsMoreAttachValidator: null
			};
			const oParam = { ...oDefaultParam, ...mParameter };

			const fnValidateFunction = oValidatorInfo => {
				const oTargetControlOrAControls = oValidatorInfo.targetControlOrControls;
				if (fnTest(oTargetControlOrAControls)) {
					// このバリデータ関数は validate メソッド実行時に呼ばれるものとなるので、エラーメッセージの除去やエラーステートの解除は不要。
					// （フォーカスアウト時のバリデータでは必要だが、それらは別途、_addValidator2Control 内でバリデータ関数が作成されて attach される）
					return true;
				}
				const sMessageTextOrAMessageTexts = oValidatorInfo.messageTextOrMessageTexts;
				const sValidateFunctionId = oValidatorInfo.validateFunctionId;
				if (Array.isArray(oTargetControlOrAControls)) {
					if (oValidatorInfo.isGroupedTargetControls) {
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

			const sControlId = oControlValidateBefore.getId();

			if (this._mRegisteredValidator.has(sControlId)) {
				const aValidateFunctions = this._mRegisteredValidator.get(sControlId);
				const oValidateFunction = aValidateFunctions.find(oValidateFunction => 
					(isOriginalFunctionIdUndefined && oValidateFunction.isOriginalFunctionIdUndefined && sMessageTextOrAMessageTexts === oValidateFunction.messageTextOrMessageTexts) ||
					(!isOriginalFunctionIdUndefined && !oValidateFunction.isOriginalFunctionIdUndefined && oValidateFunction.validateFunctionId === sValidateFunctionId));
				if (oValidateFunction) {
					oValidateFunction.testFunction = fnTest;
					oValidateFunction.messageTextOrMessageTexts = sMessageTextOrAMessageTexts;
					oValidateFunction.targetControlOrControls = oTargetControlOrAControls;
					oValidateFunction.validateFunction = fnValidateFunction;
					oValidateFunction.isGroupedTargetControls = oParam.isGroupedTargetControls;
					oValidateFunction.controlsMoreAttachValidator = oParam.controlsMoreAttachValidator;
					oValidateFunction.isOriginalFunctionIdUndefined = isOriginalFunctionIdUndefined;
				} else {
					aValidateFunctions.push({
						validateFunctionId: sValidateFunctionId,
						testFunction: fnTest,
						messageTextOrMessageTexts: sMessageTextOrAMessageTexts,
						targetControlOrControls: oTargetControlOrAControls,
						validateFunction: fnValidateFunction,
						isGroupedTargetControls: oParam.isGroupedTargetControls,
						controlsMoreAttachValidator: oParam.controlsMoreAttachValidator,
						isOriginalFunctionIdUndefined: isOriginalFunctionIdUndefined
					});
				}
			} else {
				this._mRegisteredValidator.set(sControlId, [{
					validateFunctionId: sValidateFunctionId,
					testFunction: fnTest,
					messageTextOrMessageTexts: sMessageTextOrAMessageTexts,
					targetControlOrControls: oTargetControlOrAControls,
					validateFunction: fnValidateFunction,
					isGroupedTargetControls: oParam.isGroupedTargetControls,
					controlsMoreAttachValidator: oParam.controlsMoreAttachValidator,
					isOriginalFunctionIdUndefined: isOriginalFunctionIdUndefined
				}]);
			}
			
			if (oParam.isAttachFocusoutValidationImmediately) {
				this._attachRegisteredValidator(
					oTargetControlOrAControls,
					fnTest,
					sMessageTextOrAMessageTexts,
					sValidateFunctionId,
					oParam.isGroupedTargetControls,
					oParam.controlsMoreAttachValidator);
			}
			return this;
		}

		/**
		 * oControlValidateBefore の検証後に実行する必須チェック関数を登録する。
		 * すでに oControlValidateBefore に sValidateFunctionId の関数が登録されている場合は関数を上書きする。
		 * 
		 * @public
		 * @param {string} [sValidateFunctionId] fnTest を識別するための任意のID。省略時は自動生成される
		 * @param {testFunction} fnTest oControlValidateBefore の検証後に実行される検証用の関数
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oTargetControlOrAControls 検証対象のコントロールまたはその配列
		 * @param {sap.ui.core.Control} oControlValidateBefore {@link #validate validate} oControlValidateBefore の検証後に fnTest が実行される。fnTest の実行順を指定するためのもの
		 * @param {Object} [mParameter] オプションパラメータ
		 * @returns {Validator} Reference to this in order to allow method chaining
		 */
		registerRequiredValidator(sValidateFunctionId, fnTest, oTargetControlOrAControls, oControlValidateBefore, mParameter) {
			let isOriginalFunctionIdUndefined = false;
			if (typeof sValidateFunctionId !== 'string') {
				// sValidateFunctionId 省略時は ID を自動生成する。
				mParameter = oControlValidateBefore;
				oControlValidateBefore = oTargetControlOrAControls;
				oTargetControlOrAControls = fnTest;
				fnTest = sValidateFunctionId;
				isOriginalFunctionIdUndefined = true;
			}
			const oDefaultParam = {
				isAttachFocusoutValidationImmediately: false,
				// isGroupedTargetControls: true の場合、oTargetControlOrAControls を1つのグループとみなして検証は1回だけ（コントロール数分ではない）で、エラーメッセージも1つだけで、
				// エラーステートは全部のコントロールにつくかつかないか（一部だけつくことはない）
				isGroupedTargetControls: false,
				controlsMoreAttachValidator: null
			};
			const oParam = { ...oDefaultParam, ...mParameter };

			let sMessageTextOrAMessageTexts;
			if (Array.isArray(oTargetControlOrAControls)) {
				if (oParam.controlsMoreAttachValidator) {
					throw new SyntaxError();
				}
				if (oParam.isGroupedTargetControls) {
					sMessageTextOrAMessageTexts = this._getRequiredErrorMessageTextByControl(oTargetControlOrAControls[0]);
				} else {
					sMessageTextOrAMessageTexts = oTargetControlOrAControls.map(oTargetControl => this._getRequiredErrorMessageTextByControl(oTargetControl));
				}
			} else {
				sMessageTextOrAMessageTexts = this._getRequiredErrorMessageTextByControl(oTargetControlOrAControls);
			}
			if (isOriginalFunctionIdUndefined) {
				this.registerValidator(fnTest, sMessageTextOrAMessageTexts, oTargetControlOrAControls, oControlValidateBefore, oParam);
			} else {
				this.registerValidator(sValidateFunctionId, fnTest, sMessageTextOrAMessageTexts, oTargetControlOrAControls, oControlValidateBefore, oParam);
			}
			return this;
		}

		/**
		 * {@link #registerValidator registerValidator} {@link #registerRequiredValidator registerRequiredValidator} で登録されている関数を登録解除する。
		 * 
		 * @public
		 * @param {string} sValidateFunctionId validateFunction を識別するための ID
		 * @param {sap.ui.core.Control} oControlValidateBefore コントロール
		 * @returns {Validator} Reference to this in order to allow method chaining
		 */
		unregisterValidator(sValidateFunctionId, oControlValidateBefore) {
			const sControlId = oControlValidateBefore.getId();
			if (!this._mRegisteredValidator.has(sControlId)) {
				return this;
			}
			const aValidateFunctions = this._mRegisteredValidator.get(sControlId);
			const iIndex = aValidateFunctions.findIndex(oValidateFunction => oValidateFunction.validateFunctionId === sValidateFunctionId);
			if (iIndex >= 0) {
				aValidateFunctions.splice(iIndex, 1);
			}
			if (aValidateFunctions.length === 0) {
				this._mRegisteredValidator.delete(sControlId);
			}
			return this;
		}

		/**
		 * 引数のオブジェクトもしくはその配下のコントロールにバリデータ関数を attach する。
		 *
		 * @private
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oTargetRootControl バリデータ関数を attach するコントロールもしくはそれを含むコンテナ
		 */
		_attachValidator(oTargetRootControl) {
			// 非表示のコントロールも後で表示される可能性が想定されるため、処理対象とする
			if (!(oTargetRootControl instanceof Control ||
				oTargetRootControl instanceof FormContainer ||
				oTargetRootControl instanceof FormElement ||
				oTargetRootControl instanceof IconTabFilter)) {
				return;
			}

			// sap.ui.core.LabelEnablement#isRequired は対象コントロール・エレメント自体の required 属性だけでなく、
		    // labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label の required 属性まで見て判断してくれる。
			// （なお、ariaLabelledBy で参照される Label までは見てくれない）
			// disable のコントロールも後で有効化される可能性が想定されるため、処理対象とする
			if (LabelEnablement.isRequired(oTargetRootControl)) {
				this._attachNotRegisteredValidator(oTargetRootControl);
			}
			if (this._mRegisteredValidator.has(oTargetRootControl.getId())) {
				this._mRegisteredValidator.get(oTargetRootControl.getId()).forEach(oValidateFunction => {
					this._attachRegisteredValidator(
						oValidateFunction.targetControlOrControls,
						oValidateFunction.testFunction,
						oValidateFunction.messageTextOrMessageTexts,
						oValidateFunction.validateFunctionId,
						oValidateFunction.isGroupedTargetControls,
						oValidateFunction.controlsMoreAttachValidator);
				});
			}
			// sap.ui.table.Table の場合は普通にaggregationを再帰的に処理すると存在しない行も処理対象になってしまうため、
			// Table.getBinding().getLength() してその行までの getRows() の getCells() のコントロールを処理する。
			if (oTargetRootControl instanceof sapUiTableTable && oTargetRootControl.getBinding()) {
				const aRows = oTargetRootControl.getRows();
				for (let i = 0, iTableRowCount = oTargetRootControl.getBinding().getLength(); i < iTableRowCount; i++) {
					const aCellControls = aRows[i].getCells();
					if (aCellControls) {
						for (let j = 0; j < aCellControls.length; j++) {
							this._attachValidator(aCellControls[j]);
						}
					}
				}
			} else {
				// sap.ui.table.Table や入力コントロールでなかった場合は、aggregation のコントロールを再帰的に処理する。
				for (let i = 0; i < this._aTargetAggregations.length; i++) {
					const aControlAggregation = oTargetRootControl.getAggregation(this._aTargetAggregations[i]);
					if (!aControlAggregation) {
						continue;
					}
					if (Array.isArray(aControlAggregation)) {
						for (let j = 0; j < aControlAggregation.length; j++) {
							this._attachValidator(aControlAggregation[j]);
						}
					} else {
						this._attachValidator(aControlAggregation);
					}
				}
			}
		}

		/**
		 * 引数のオブジェクトとその配下のコントロールのバリデーションを行う。
		 *
		 * @private
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement|sap.m.IconTabFilter} oTargetRootControl 検証対象のコントロールもしくはそれを含むコンテナ
		 * @returns {boolean}　true: valid, false: invalid
		 */
		_validate(oTargetRootControl) {
			let isValid = true;
			const sTargetRootControlId = oTargetRootControl.getId();

			if (!((oTargetRootControl instanceof Control ||
				oTargetRootControl instanceof FormContainer ||
				oTargetRootControl instanceof FormElement ||
				oTargetRootControl instanceof IconTabFilter) &&
				oTargetRootControl.getVisible())) {
				
				if (!this._callRegisteredValidator(sTargetRootControlId)) {
					isValid = false;
				}
				return isValid;
			}

			// sap.ui.table.Table の場合は普通にaggregationを再帰的に処理すると存在しない行も処理対象になってしまうため、
			// Table.getBinding().getLength() してその行までの getRows() の getCells() のコントロールを検証する。
			if (oTargetRootControl instanceof sapUiTableTable && oTargetRootControl.getBinding()) {
				const aRows = oTargetRootControl.getRows();
				for (let i = 0, iTableRowCount = oTargetRootControl.getBinding().getLength(); i < iTableRowCount; i++) {
					const aCellControls = aRows[i].getCells();
					if (aCellControls) {
						for (let j = 0; j < aCellControls.length; j++) {
							if (!this._validate(aCellControls[j])) {
								isValid = false;
							}
						}
					}
				}
			} else {
				// sap.ui.core.LabelEnablement#isRequired は対象コントロール・エレメント自体の required 属性だけでなく、
				// labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label の required 属性まで見て判断してくれる。
				// （なお、ariaLabelledBy で参照される Label までは見てくれない）
				if (((oTargetRootControl.getEnabled && oTargetRootControl.getEnabled()) || !oTargetRootControl.getEnabled) &&
					LabelEnablement.isRequired(oTargetRootControl)) {
					isValid = this._validateRequired(oTargetRootControl);
				}
				// sap.ui.table.Table や入力コントロールでなかった場合は、aggregation のコントロールを再帰的に検証する。
				for (let i = 0; i < this._aTargetAggregations.length; i++) {
					const aControlAggregation = oTargetRootControl.getAggregation(this._aTargetAggregations[i]);
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
			}
			if (!this._callRegisteredValidator(sTargetRootControlId)) {
				isValid = false;
			}
			return isValid;
		}

		/**
		 * sControlId のコントロールのバリデーションの直後に実行するように登録済のバリデータ関数を呼び出す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 * @returns {boolean} true: valid, false: invalid
		 */
		_callRegisteredValidator(sControlId) {
			let isValid = true;

			if (this._mRegisteredValidator.has(sControlId)) {
				this._mRegisteredValidator.get(sControlId).forEach(oRegisteredValidatorInfo => {
					if (!oRegisteredValidatorInfo.validateFunction(oRegisteredValidatorInfo)) {
						isValid = false;
					}
				});
			}
			return isValid;
		}

		/**
		 * oControl に必須チェック用フォーカスアウトバリデータを attach する。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl コントロール
		 */
		_attachNotRegisteredValidator(oControl) {
			if (!oControl.attachSelectionFinish && !oControl.attachChange && !oControl.attachSelect) {
				// 対象外
				return;
			}
			const sControlId = oControl.getId();
			if (this._isAttachedNotRegisteredValidator(sControlId)) {
				return;
			}
			const sMessageText = this._getRequiredErrorMessageTextByControl(oControl);
			
			if (oControl.attachSelectionFinish) {
				oControl.attachSelectionFinish(sMessageText, this._notRegisteredValidator, this);
				this._markAttachedNotRegisteredValidator(sControlId);
			} else if (oControl.attachChange) {
				oControl.attachChange(sMessageText, this._notRegisteredValidator, this);
				this._markAttachedNotRegisteredValidator(sControlId);
			} else if (oControl.attachSelect) {
				oControl.attachSelect(sMessageText, this._notRegisteredValidator, this);
				this._markAttachedNotRegisteredValidator(sControlId);
			}
		}

		/**
		 * oControl に {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータを attach する。
		 * 
		 * @private
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oControlOrAControls コントロールまたはコントロール配列
		 * @param {testFunction} fnTest attach するバリデータ関数
		 * @param {string|string[]} sMessageTextOrAMessageTexts 検証エラーメッセージまたはその配列
		 * @param {string} sValidateFunctionId fnTest を識別するための任意のID
		 * @param {boolean} bIsGroupedTargetControls true: oControlOrAControls を1つのグループとみなして検証は1回だけ（コントロール数分ではない）で、エラーメッセージも1つだけで、エラーステートは全部のコントロールにつくかつかないか（一部だけつくことはない）,
		 *                                           false: oControlOrAControls を1つのグループとみなさない
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} [oControlOrAControlsMoreAttachValidator] oControlOrAControls 以外に fnTest を追加で attach するコントロールの配列
		 */
		_attachRegisteredValidator(oControlOrAControls, fnTest, sMessageTextOrAMessageTexts, sValidateFunctionId, bIsGroupedTargetControls, oControlOrAControlsMoreAttachValidator) {
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
				const sControlId = oControl.getId();

				if (this._isAttachedRegisteredValidator(sControlId)) {
					continue;
				}
				let sMessageText;
				if (bIsGroupedTargetControls) {
					sMessageText = Array.isArray(sMessageTextOrAMessageTexts) ? sMessageTextOrAMessageTexts[0] : sMessageTextOrAMessageTexts;
				} else {
					sMessageText = Array.isArray(sMessageTextOrAMessageTexts) ? sMessageTextOrAMessageTexts[i] : sMessageTextOrAMessageTexts;
				}
				const oData = {
					targetControl: oControl,
					messageText: sMessageText,
					test: fnTest,
					controls: aControls,
					validateFunctionId: sValidateFunctionId,
					isGroupedTargetControls: bIsGroupedTargetControls,
					messageTextOrMessageTexts: sMessageTextOrAMessageTexts
				};
				if (oControl.attachSelectionFinish) {
					oControl.attachSelectionFinish(oData, this._registeredvalidator, this);
					this._markAttachedRegisteredValidator(sControlId);
				} else if (oControl.attachChange) {
					oControl.attachChange(oData, this._registeredvalidator, this);
					this._markAttachedRegisteredValidator(sControlId);
				} else if (oControl.attachSelect) {
					oControl.attachSelect(oData, this._registeredvalidator, this);
					this._markAttachedRegisteredValidator(sControlId);
				}

				if (oControlOrAControlsMoreAttachValidator && i === 0) {
					let aControlsMoreAttachValidator;
					if (!Array.isArray(oControlOrAControlsMoreAttachValidator)) {
						aControlsMoreAttachValidator = [oControlOrAControlsMoreAttachValidator];
					} else {
						aControlsMoreAttachValidator = oControlOrAControlsMoreAttachValidator;
					}
					for (let j = 0; j < aControlsMoreAttachValidator.length; j++) {
						const oControlMore = aControlsMoreAttachValidator[j];
						const sControlMoreId = oControlMore.getId();
						if (this._isAttachedRegisteredValidator(sControlMoreId)) {
							continue;
						}
						if (oControlMore.attachSelectionFinish) {
							oControlMore.attachSelectionFinish(oData, this._registeredvalidator, this);
							this._markAttachedRegisteredValidator(sControlMoreId);
						} else if (oControlMore.attachChange) {
							oControlMore.attachChange(oData, this._registeredvalidator, this);
							this._markAttachedRegisteredValidator(sControlMoreId);
						} else if (oControlMore.attachSelect) {
							oControlMore.attachSelect(oData, this._registeredvalidator, this);
							this._markAttachedRegisteredValidator(sControlMoreId);
						}
					}
				}
			}
		}

		/**
		 * 必須チェック用フォーカスアウトバリデータを attach 済みかどうかを返す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 * @returns {boolean} true: 必須チェック用フォーカスアウトバリデータを attach 済み, false: 必須チェック用フォーカスアウトバリデータを attach 済みでない
		 */
		_isAttachedNotRegisteredValidator(sControlId) {
			return this._isAttachedValidator(sControlId, false);
		}

		/**
		 * {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータを attach 済みかどうかを返す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 * @returns {boolean} true: フォーカスアウトバリデータを attach 済み, false: フォーカスアウトバリデータを attach 済みでない
		 */
		_isAttachedRegisteredValidator(sControlId) {
			return this._isAttachedValidator(sControlId, true);
		}

		/**
		 * フォーカスアウトバリデータを attach 済みかどうかを返す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 * @param {boolean} bIsRegisteredValidator true: {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータ, false: 必須チェック用フォーカスアウトバリデータ
		 * @returns {boolean} true: フォーカスアウトバリデータを attach 済み, false: フォーカスアウトバリデータを attach 済みでない
		 */
		_isAttachedValidator(sControlId, bIsRegisteredValidator) {
			const oValidatorType = this._mControlIdAttachedValidator.get(sControlId);
			if (!oValidatorType) {
				return false;
			}
			if (bIsRegisteredValidator) {
				return oValidatorType.registered;
			}
			return oValidatorType.notRegistered;
		}

		/**
		 * 必須チェック用フォーカスアウトバリデータを attach 済みとマークする。
		 * 
		 * @private
		 * @param {string} sControlId コントロールの ID
		 */
		_markAttachedNotRegisteredValidator(sControlId) {
			this._markAttachedValidator(sControlId, false);
		}

		/**
		 * {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータを attach 済みとマークする。
		 * 
		 * @private
		 * @param {string} sControlId コントロールの ID
		 */
		_markAttachedRegisteredValidator(sControlId) {
			this._markAttachedValidator(sControlId, true);
		}

		/**
		 * フォーカスアウトバリデータを attach 済みとマークする。
		 * 
		 * @private
		 * @param {string} sControlId コントロールの ID
		 * @param {boolean} bIsRegisteredValidator true: {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータ, false: 必須チェック用フォーカスアウトバリデータ
		 */
		_markAttachedValidator(sControlId, bIsRegisteredValidator) {
			const oValidatorType = this._mControlIdAttachedValidator.get(sControlId);
			if (oValidatorType) {
				if (bIsRegisteredValidator) {
					oValidatorType.registered = true;
				} else {
					oValidatorType.notRegistered = true;
				}
			} else {
				this._mControlIdAttachedValidator.set(sControlId, {
					registered: bIsRegisteredValidator,
					notRegistered: !bIsRegisteredValidator
				});
			}
		}

		/**
		 * 必須チェック用フォーカスアウトバリデータを attach 済みとマークしていたのを外す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 */
		_unmarkAttachedNotRegisteredValidator(sControlId) {
			this._unmarkAttachedValidator(sControlId, false);
		}

		/**
		 * {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータを attach 済みとマークしていたのを外す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 */
		_unmarkAttachedRegisteredValidator(sControlId) {
			this._unmarkAttachedValidator(sControlId, true);
		}

		/**
		 * フォーカスアウトバリデータを attach 済みとマークしていたのを外す。
		 * 
		 * @private
		 * @param {string} sControlId コントロールID
		 * @param {boolean} bIsRegisteredValidator true: {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータ, false: 必須チェック用フォーカスアウトバリデータ
		 */
		_unmarkAttachedValidator(sControlId, bIsRegisteredValidator) {
			const oValidatorType = this._mControlIdAttachedValidator.get(sControlId);
			if (!oValidatorType) {
				return;
			}
			if (bIsRegisteredValidator) {
				oValidatorType.registered = false;
			} else {
				oValidatorType.notRegistered = false;
			}
		}

		/**
		 * oControl に attach されている必須チェック用フォーカスアウトバリデータを detach する。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl コントロール
		 */
		_detachNotRegisteredValidator(oControl) {
			const sControlId = oControl.getId();
			if (oControl.detachSelectionFinish) {
				oControl.detachSelectionFinish(this._notRegisteredValidator, this);
				this._unmarkAttachedNotRegisteredValidator(sControlId);
			} else if (oControl.detachChange) {
				oControl.detachChange(this._notRegisteredValidator, this);
				this._unmarkAttachedNotRegisteredValidator(sControlId);
			} else if (oControl.detachSelect) {
				oControl.detachSelect(this._notRegisteredValidator, this);
				this._unmarkAttachedNotRegisteredValidator(sControlId);
			}
		}

		/**
		 * oControl に attach されている {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータを detach する。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl コントロール
		 */
		_detachRegisteredValidator(oControl) {
			const sControlId = oControl.getId();
			if (oControl.detachSelectionFinish) {
				oControl.detachSelectionFinish(this._registeredvalidator, this);
				this._unmarkAttachedRegisteredValidator(sControlId);
			} else if (oControl.detachChange) {
				oControl.detachChange(this._registeredvalidator, this);
				this._unmarkAttachedRegisteredValidator(sControlId);
			} else if (oControl.detachSelect) {
				oControl.detachSelect(this._registeredvalidator, this);
				this._unmarkAttachedRegisteredValidator(sControlId);
			}
		}

		/**
		 * 必須チェック用フォーカスアウトバリデータ関数
		 * 
		 * @private
		 * @param {sap.ui.base.Event} oEvent イベント
		 * @param {string} sMessageText エラーメッセージ
		 */
		_notRegisteredValidator(oEvent, sMessageText) {
			const oControl = oEvent.getSource();
			if (this._isNullValue(oControl)) {
				this._addMessage(oControl, sMessageText);
				this._setValueState(oControl, ValueState.Error, sMessageText);
			} else {
				this._removeMessageAndValueState(oControl);
			}
		}

		/**
		 * {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータ関数
		 * 
		 * @private
		 * @param {sap.ui.base.Event} oEvent イベント
		 * @param {Object} oData データ
		 * @param {function} oData.test バリデータ関数
		 * @param {sap.ui.core.Control[]} oData.controls 合わせてエラー状態がセットまたは解除されるコントロールの配列
		 * @param {boolean} oData.isGroupedTargetControls true: oData.controls を1つのグループとみなす, false: oData.controls を1つのグループとみなさない
		 * @param {string} oData.messageText エラーメッセージ
		 * @param {string} oData.validateFunctionId バリデータ関数を識別するID
		 */
		_registeredvalidator(oEvent, oData) {
			const oControl = oData.targetControl;
			const oControlOrAControls = oData.controls.length > 1 ? oData.controls : oData.controls[0];
			if (oData.test(oControlOrAControls)) {
				oData.controls.forEach(oCtl => {
					// 例えば、日付の大小関係チェックのように、自身以外のコントロールの値が修正されてフォーカスアウトしたことで、自身も正常となるので対象コントロール達のエラーは解除する。
					this._removeMessageAndValueState(oCtl, oData.validateFunctionId);
				});
			} else {
				if (oData.isGroupedTargetControls) {
					this._addMessage(oData.controls, oData.messageText, oData.validateFunctionId);
					
					oData.controls.forEach(oCtl => {
						this._setValueState(oCtl, ValueState.Error, oData.messageText);
					});
				} else {
					this._addMessage(oControl, oData.messageText, oData.validateFunctionId);
					this._setValueState(oControl, ValueState.Error, oData.messageText);
				}
			}
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

		/**
		 * メッセージを除去し、oControl に他にエラーがなければエラーステートをクリアする。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl 対象のコントロール
		 * @param {string} [sValidateFunctionId] 検証を行った関数のID
		 *                                       {@link #registerValidator registerValidator} や {@link #registerRequiredValidator registerRequiredValidator} で登録されたフォーカスアウトバリデータ関数で検証した場合にのみ必要
		 */
		_removeMessageAndValueState(oControl, sValidateFunctionId) {
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const sValidatorMessageName = _ValidatorMessage.getMetadata().getName();
			const sControlId = oControl.getId();

			const oMessage = oMessageModel.getProperty("/").find(oMsg =>
				BaseObject.isA(oMsg, sValidatorMessageName) &&
				oMsg.getValidationErrorControlIds().includes(sControlId) &&
				oMsg.getValidateFunctionId() === sValidateFunctionId);
			if (oMessage) {
				oMessageManager.removeMessages(oMessage);
			}
			this._clearValueStateIfNoErrors(oControl, this._resolveMessageTarget(oControl));
		}

		/**
		 * 不正な値を入力された場合、標準のバリデーションによりエラーステートがセットされている可能性があるため、
		 * 該当のコントロールにエラーメッセージがまだあるか確認し、ない場合にのみエラーステートをクリアする。
		 * 
		 * @param {sap.ui.core.Control} oControl 処理対象のコントロール
		 * @param {string|string[]} sTargetOrATargets セットされているメッセージの中から対象のコントロールのメッセージを判別するための Message の target/targets プロパティ値
		 */
		_clearValueStateIfNoErrors(oControl, sTargetOrATargets) {
			if (!oControl.setValueState) {
				return;
			}
			let aTargets;
			if (!Array.isArray(sTargetOrATargets)) {
				aTargets = [sTargetOrATargets];
			} else if (sTargetOrATargets.length === 0) {
				return;
			} else {
				aTargets = sTargetOrATargets;
			}

			const aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/");
			aTargets.forEach(sTarget => {
				if (!aMessages.find(oMessage => {
					if (oMessage.getTargets) {
						return oMessage.getTargets().includes(sTarget);
					}
					return oMessage.getTarget() === sTarget;
				})) {
					this._setValueState(oControl, ValueState.None, null);
				}
			});
		}

		/**
		 * oControl が sParentControlId のコントロール自身もしくはその子供かどうか判定する。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl 判定対象のコントロール
		 * @param {string} sParentControlId 親コントロールID
		 * @returns true: 親コントロール自身かその子供, false: 親コントロールでもその子供でもない
		 */
		_isChildOrEqualControlId(oControl, sParentControlId) {
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

		/**
		 * oControlOrAControls に対応する {@link Message Message} の target 文字列を返す。
		 * 
		 * @private
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oControlOrAControls コントロールまたはその配列
		 * @returns {string} target 文字列
		 */
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
		 * oControl の値が空か判定する。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl 検証対象のコントロール
		 * @returns {boolean} true: 値が空, false: 値が空でない
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

		/**
		 * 必須エラーメッセージを返す。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl コントロール
		 * @returns {string} 必須エラーメッセージ
		 */
		_getRequiredErrorMessageTextByControl(oControl) {
			const sRequiredInputMessage = "Required to input.";
			const sRequiredSelectMessage = "Required to select.";

			// sap.m.Input には getValue も getSelectedKey もあるので個別に判定する。
			if (oControl instanceof Input) {
				return this._getResourceText(this.RESOURCE_BUNDLE_KEY_REQUIRED_INPUT, sRequiredInputMessage);
			}
			if (oControl.getSelectedKey ||
				oControl.getSelectedKeys ||
				oControl.getSelected ||
				oControl.getSelectedIndex ||
				oControl.getSelectedDates) {
				return this._getResourceText(this.RESOURCE_BUNDLE_KEY_REQUIRED_SELECT, sRequiredSelectMessage);
			}
			return this._getResourceText(this.RESOURCE_BUNDLE_KEY_REQUIRED_INPUT, sRequiredInputMessage);
		}

		/**
		 * リソースバンドルからテキストを取得して返す。リソースバンドルが設定されていない場合は sDefaultText を返す。
		 * 
		 * @private
		 * @param {string} sKey キー
		 * @param {string} sDefaultText デフォルトのテキスト
		 * @returns テキスト
		 */
		_getResourceText(sKey, sDefaultText) {
			if (this._resourceBundle) {
				return this._resourceBundle.getText(sKey);
			}
			return sDefaultText;
		}

		/**
         * oControl のラベルテキストを返す。
		 * 
		 * @private
		 * @param {sap.ui.core.Control} oControl コントロール
		 * @returns {string} ラベルテキスト。ラベルが見つからない場合は undefined
		 */
		_getLabelText(oControl) {
			// sap.ui.core.LabelEnablement#getReferencingLabels は
			// labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label まで取得してくれる。
			// （なお、ariaLabelledBy で参照される Label までは取得してくれない）
			// 試した結果は以下の通り。
			// - SimpleForm内で、labelForなし											ラベルID取得OK
			// - SimpleForm外で、labelForあり											ラベルID取得OK
			// - SimpleForm外で、labelForなし、入力コントロール側にariaLabelledByあり		ラベルID取得NG（ariaLabelledByまでは見に行かない）
			// - SimpleForm外で、labelForなし、入力コントロール側にariaLabelledByなし		ラベルID取得NG（紐付ける手がかりが一切ないので当たり前）

			// sap.m.CheckBox の場合、そのまま LabelEnablement.getReferencingLabels を取得すると各チェックボックスのラベルが取得されるので、
			// 親のコントロールのラベルを探してみる。（親のラベルが見つかるかはビューの構造による。例えば、SimpleForm 内では見つからない）
			if (oControl instanceof CheckBox && oControl.getParent()) {
				const aLabelId = LabelEnablement.getReferencingLabels(oControl.getParent());
				if (aLabelId && aLabelId.length > 0) {
					const oLabel = Element.registry.get(aLabelId[0]);
					if (oLabel && oLabel.getText) {
						return oLabel.getText();
					}
				}
			}
			if (oControl.getParent) {
				const oParent = oControl.getParent();

				if (oParent instanceof sapUiTableRow) {
					// sap.ui.table.Table, sap.ui.table.Row, sap.ui.table.Column の場合
					const oRow = oParent;
					if (oRow.getParent() instanceof sapUiTableTable) {
						const oTable = oRow.getParent();
						const iColumnIndex = oRow.indexOfCell(oControl);
						if (iColumnIndex !== -1) {
							const oLabelOrSLabel = oTable.getColumns()[iColumnIndex].getLabel();
							if (typeof oLabelOrSLabel === "string") {
								return oLabelOrSLabel;
							} else if (oLabelOrSLabel.getText) {
								return oLabelOrSLabel.getText();
							}
						}
					}
					return undefined;
				} else if (oParent instanceof ColumnListItem) {
					// sap.m.Table, sap.m.Column, sap.m.ColumnListItem の場合
					const oColumnListItem = oParent;
					if (oColumnListItem.getParent() instanceof sapMTable) {
						const oTable = oColumnListItem.getParent();
						const iColumnIndex = oColumnListItem.indexOfCell(oControl);
						if (iColumnIndex !== -1) {
							const oColumnHeader = oTable.getColumns()[iColumnIndex].getHeader();
							if (oColumnHeader && oColumnHeader.getText) {
								return oColumnHeader.getText();
							}
						}
					}
					return undefined;
				}
			}
			const aLabelId = LabelEnablement.getReferencingLabels(oControl);
			if (aLabelId && aLabelId.length > 0) {
				const oLabel = Element.registry.get(aLabelId[0]);
				if (oLabel && oLabel.getText) {
					return oLabel.getText();
				}
			}
			return undefined;
		}

		/**
		 * {@link sap.ui.core.message.MessageManager MessageManager} にメッセージを追加する。
		 *
		 * @private
		 * @param {sap.ui.core.Control|sap.ui.core.Control[]} oControlOrAControls 検証エラーとなったコントロール
		 * @param {string} sMessageText エラーメッセージ
		 * @param {string} [sValidateFunctionId] 検証を行った関数のID。this._mRegisteredValidator に含まれる関数で検証した場合にのみ必要
		 */
		_addMessage(oControlOrAControls, sMessageText, sValidateFunctionId) {
			let oControl;
			let aControls;
			if (Array.isArray(oControlOrAControls)) {
				oControl = oControlOrAControls[0];
				aControls = oControlOrAControls;
			} else {
				oControl = oControlOrAControls;
				aControls = [oControlOrAControls];
			}
			sap.ui.getCore().getMessageManager().addMessages(new _ValidatorMessage({
				message: sMessageText,
				type: MessageType.Error,
				additionalText: this._getLabelText(oControl),
				processor: new ControlMessageProcessor(),
				target: this._resolveMessageTarget(oControlOrAControls),
				validationErrorControlIds: aControls.map(oControl => oControl.getId()),
				validateFunctionId: sValidateFunctionId
			}));
		}

		/**
		 * 引数のコントロールに {@link sap.ui.core.ValueState ValueState} と ValueStateText をセットする。
		 *
		 * @private
		 * @param {sap.ui.core.Control} oControl セット先のコントロール
		 * @param {sap.ui.core.ValueState} oValueState セットするステート
		 * @param {string} sText セットするステートテキスト
		 */
		_setValueState(oControl, oValueState, sText) {
			if (oControl.setValueState) {
				oControl.setValueState(oValueState);
				if (oValueState === ValueState.Error) {
					this._markSetValueStateError(oControl);
				} else if (oValueState === ValueState.None) {
					this._unmarkSetValueStateError(oControl);
				}
			}
			if (oControl.setValueStateText) {
				oControl.setValueStateText(sText);
			}
		}

		/**
		 * 本 Validator によりエラーステートをセットされているかを判定する。
		 * 
		 * @private
		 * @param {sap.ui.core.Element} oElement エレメント
		 * @returns true: 本 Validator によりエラーステートをセットされている, false: セットされていない
		 */
		_isSetValueStateError(oElement) {
			return oElement.data(this._CUSTOM_DATA_KEY_FOR_IS_SET_VALUE_STATE_ERROR) === "true";
		}

		/**
		 * 本 Validator によりエラーステートをセットしたとマークする。
		 * 
		 * @private
		 * @param {sap.ui.core.Element} oElement エレメント
		 */
		_markSetValueStateError(oElement) {
			oElement.data(this._CUSTOM_DATA_KEY_FOR_IS_SET_VALUE_STATE_ERROR, "true");
		}

		/**
		 * 本 Validator によりエラーステートをセットしたとマークしていたのを外す。
		 * 
		 * @private
		 * @param {sap.ui.core.Element} oElement エレメント
		 */
		_unmarkSetValueStateError(oElement) {
			oElement.data(this._CUSTOM_DATA_KEY_FOR_IS_SET_VALUE_STATE_ERROR, null);
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
			
			this.validationErrorControlIds = [];
			if (mParameters && mParameters.validationErrorControlIds && Array.isArray(mParameters.validationErrorControlIds) && mParameters.validationErrorControlIds.length > 0) {
				this.validationErrorControlIds = mParameters.validationErrorControlIds;

				// https://sapui5.hana.ondemand.com/#/api/sap.ui.core.message.Message/methods/getControlId に InputBase のコントロールにしか
				// controlIdはセットされないと書かれている。実際に、例えば RadioButton ではセットされない。なぜ、こういう仕様にしているのかは不明。
				// 本メッセージクラスではコントロールに関わらずセットする（ただし、何らかの問題が見つかった場合はセットするのをやめる可能性あり）。
				this.addControlId(mParameters.validationErrorControlIds[0]);
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
	_ValidatorMessage.prototype.getValidationErrorControlIds = function() {
		return this.validationErrorControlIds;
	};
	_ValidatorMessage.prototype.getValidateFunctionId = function() {
		return this.validateFunctionId;
	};

	return Validator;
});
