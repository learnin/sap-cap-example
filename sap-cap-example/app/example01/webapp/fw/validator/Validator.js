sap.ui.define([
	"sap/ui/base/Object",
	"sap/ui/core/message/ControlMessageProcessor",
	"sap/ui/core/message/Message",
	"sap/ui/core/LabelEnablement",
	"sap/ui/core/MessageType",
	"sap/ui/core/ValueState"
], function (
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
		}

		/**
		 * 引数のコントロールもしくはその配下のコントロールやエレメントのバリデーションを行う。
		 *
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
		 * @returns {boolean} true: valid、false: invalid
		 */
		validate(oControl) {
			return this._validate(oControl);
		}

		/**
		 * 引数のコントロールもしくはその配下のコントロールやエレメントについて、本クラスにより追加されたメッセージを
		 * {@link sap.ui.core.message.MessageManager MessageManager} から除去する。
		 * その結果、該当コントロールやエレメントにメッセージがなくなった場合は、{@link sap.ui.core.ValueState ValueState} もクリアする。
		 *
		 * @public
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
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

		// TODO: 相関バリデーションをアプリで実装した際にバリデートエラー時に呼べるaddMessage系のメソッドを用意する

		/**
		 * 引数のコントロール配下のフィールドのバリデーションを行う。
		 *
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
		 * @returns {boolean}　true: valid、false: invalid
		 */
		_validate(oControl) {
			if (!((oControl instanceof sap.ui.core.Control ||
				oControl instanceof sap.ui.layout.form.FormContainer ||
				oControl instanceof sap.ui.layout.form.FormElement ||
				oControl instanceof sap.m.IconTabFilter) &&
				oControl.getVisible())) {
				return true;
			}

			let isValid = true;

			// sap.ui.core.LabelEnablement#isRequired は対象コントロール・エレメント自体の required 属性だけでなく、
		    // labelFor 属性で紐づく Label や、sap.ui.layout.form.SimpleForm 内での対象コントロール・エレメントの直前の Label の required 属性まで見て判断してくれる。
			// （なお、ariaLabelledBy で参照される Label までは見てくれない）
			if (((oControl.getEnabled && oControl.getEnabled()) || !oControl.getEnabled) &&
				LabelEnablement.isRequired(oControl)) {
				isValid = this._validateRequired(oControl);
			} else {
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
			}
			return isValid;
		}

		/**
		 * 引数のコントロールやエレメントの必須チェックを行う。
		 *
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
		 * @returns {boolean}　true: valid、false: invalid
		 */
		_validateRequired(oControl) {
			if (!this._isNullValue(oControl)) {
				return true;
			}
			const sMessageText = this._getMessageTextByControl(oControl);
			this._setValueState(oControl, ValueState.Error, sMessageText);
			this._addMessage(oControl, sMessageText);

			if (oControl.attachChange) {
				// ValueState とエラーメッセージが残ったままにならないように、対象のコントロールの change イベントで ValueState とエラーメッセージを除去する。
				const fnOnChange = oEvent => {
					oControl.detachChange(fnOnChange);
					this._removeMessageAndValueState(oControl);
				};
				oControl.attachChange(fnOnChange);
			}
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
					if (!oTargetRootControl) {
						oMessageManager.removeMessages(oMessage);
					}
					continue;
				}

				if (!oTargetRootControl || this._isChildOrEqualControlId(oControl, oTargetRootControl)) {
					oMessageManager.removeMessages(oMessage);
					this._clearValueStateIfNoErrors(oControl, oMessage.getTarget())
				}
			}
		}

		_removeMessageAndValueState(oControl) {
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const sValidatorMessageName = _ValidatorMessage.getMetadata().getName();
			const sControlId = oControl.getId();

			const oMessage = oMessageModel.getProperty("/").find(oMsg => BaseObject.isA(oMsg, sValidatorMessageName) && oMsg.getValidationErrorControlId() === sControlId);
			if (oMessage) {
				oMessageManager.removeMessages(oMessage);
			}
			this._clearValueStateIfNoErrors(oControl, this._resolveMessageTarget(oControl))
		}

		/**
		 * 不正な値を入力された場合、標準のバリデーションによりエラーステートがセットされている可能性があるため、
		 * 該当のコントロールにエラーメッセージがまだあるか確認し、ない場合にのみエラーステートをクリアする。
		 * 
		 * @param {*} oControl 
		 * @param {string} sTarget 
		 */
		_clearValueStateIfNoErrors(oControl, sTarget) {
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

		_resolveMessageTarget(oControl) {
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
		}

		/**
		 * 
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
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

		_getMessageTextByControl(oControl) {
			if (oControl.getBindingPath("selectedKey") ||
				oControl.getBindingPath("selected") ||
				oControl.getBindingPath("selectedIndex") ||
				oControl.getBindingPath("selectedDates")) {
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
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl 検証対象のコントロールやエレメント
		 * @param {string} sMessageText エラーメッセージ
		 */
		_addMessage(oControl, sMessageText) {
			sap.ui.getCore().getMessageManager().addMessages(new _ValidatorMessage({
				message: sMessageText,
				type: MessageType.Error,
				additionalText: this._getLabelText(oControl),
				processor: new ControlMessageProcessor(),
				target: this._resolveMessageTarget(oControl),
				validationErrorControlId: oControl.getId()
			}));
		}

		/**
		 * 引数のコントロールに {@link sap.ui.core.ValueState ValueState} と ValueStateText をセットする。
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl 検証対象のコントロールやエレメント
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
			Message.apply(this, arguments);
			
			if (mParameters && mParameters.validationErrorControlId) {
				this.validationErrorControlId = mParameters.validationErrorControlId;
				// https://sapui5.hana.ondemand.com/#/api/sap.ui.core.message.Message/methods/getControlId に InputBase のコントロールにしか
				// controlIdはセットされないと書かれている。実際に、例えば RadioButton ではセットされない。なぜ、こういう仕様にしているのかは不明。
				// 本メッセージクラスではコントロールに関わらずセットする（ただし、何らかの問題が見つかった場合はセットするのをやめる可能性あり）。
				this.addControlId(mParameters.validationErrorControlId);
			}
		}
	});
	_ValidatorMessage.prototype.getValidationErrorControlId = function() {
		return this.validationErrorControlId;
	};

	return Validator;
});
