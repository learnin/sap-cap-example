sap.ui.define([
	"sap/m/CheckBox",
	"sap/m/Input",
	"sap/m/Select",
	"sap/ui/base/Object",
	"sap/ui/core/message/ControlMessageProcessor",
	"sap/ui/core/message/Message",
	"sap/ui/core/Element",
	"sap/ui/core/MessageType",
	"sap/ui/core/ValueState"
], function (
	CheckBox,
	Input,
	Select,
	BaseObject,
	ControlMessageProcessor,
	Message,
	Element,
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
			// TODO: これで過不足ないか
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
			// 例えば sap.m.CheckBox など、required プロパティをもたないコントロールやエレメントについても必須チェックを可能とするために
			// required プロパティが true でかつ、labelFor プロパティがあるラベルがあれば、その labelFor の対象コントロールやエレメントも必須チェック対象とする。
			const aRequiredLabelsWithLabelFor = Element.registry.filter((oElement, sID) =>
				oElement.getRequired && oElement.getRequired() &&
				oElement.getLabelFor && oElement.getLabelFor() &&
				oElement.getVisible && oElement.getVisible());
			const aRequiredLabelFors = aRequiredLabelsWithLabelFor.map(oLabel => oLabel.getLabelFor());
			return this._validate(oControl, aRequiredLabelFors);
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
		_validate(oControl, aRequiredControlIds) {
			if (!((oControl instanceof sap.ui.core.Control ||
				oControl instanceof sap.ui.layout.form.FormContainer ||
				oControl instanceof sap.ui.layout.form.FormElement ||
				oControl instanceof sap.m.IconTabFilter) &&
				oControl.getVisible())) {
				return true;
			}

			let isValid = true;

			if (oControl.getEnabled && oControl.getEnabled() &&
				((oControl.getRequired && oControl.getRequired()) || aRequiredControlIds.includes(oControl.getId()))) {
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
							if (!this._validate(aControlAggregation[j], aRequiredControlIds)) {
								isValid = false;
							}
						}
					} else {
						if (!this._validate(aControlAggregation, aRequiredControlIds)) {
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
				const oControl = Element.registry.get(oMessage.getValidationErrorControlId());
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
			// sap.m.InputBase（サブクラスに sap.ca.ui.DatePicker, sap.m.ComboBoxTextField, sap.m.DateTimeField, sap.m.Input,
			// sap.m.MaskInput, sap.m.TextArea, sap.m.ComboBox, sap.m.MultiComboBox 等がある）
			if (oControl.getBindingPath("value")) {
				return oControl.getId() + "/value";
			}
			// TODO: sap.m.Select で動作確認必要
			if (oControl.getBindingPath("selectedKey")) {
				return oControl.getId() + "/selectedKey";
			}
			// TODO: sap.m.RadioButton で動作確認必要
			if (oControl.getBindingPath("selected")) {
				return oControl.getId() + "/selected";
			}
			// TODO: sap.m.RadioButtonGroup で動作確認必要
			if (oControl.getBindingPath("selectedIndex")) {
				return oControl.getId() + "/selectedIndex";
			}
			// TODO: sap.ui.unified.Calendar で動作確認必要
			if (oControl.getBindingPath("selectedDates")) {
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
			// sap.m.InputBase（サブクラスに sap.ca.ui.DatePicker, sap.m.ComboBoxTextField, sap.m.DateTimeField, sap.m.Input,
			// sap.m.MaskInput, sap.m.TextArea, sap.m.ComboBox, sap.m.MultiComboBox 等がある）
			if (oControl.getBindingPath("value")) {
				return !oControl.getValue();
			}
			// TODO: sap.m.Select で動作確認必要
			if (oControl.getBindingPath("selectedKey")) {
				return !oControl.getSelectedKey();
			}
			// TODO: sap.m.RadioButton で動作確認必要
			if (oControl.getBindingPath("selected")) {
				return !oControl.getSelected();
			}
			// TODO: sap.m.RadioButtonGroup で動作確認必要
			if (oControl.getBindingPath("selectedIndex")) {
				return oControl.getSelectedIndex() === -1 ? true : false;
			}
			// TODO: sap.ui.unified.Calendar で動作確認必要
			if (oControl.getBindingPath("selectedDates")) {
				return oControl.getSelectedDates().length === 0;
			}
			return false;
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

		_getLabelText(oControl) {
			if (oControl instanceof Input ||
				oControl instanceof CheckBox ||
				oControl instanceof Select) {
				const oParent = oControl.getParent();
				if (oParent) {
					const oLabel = oParent.getLabel();
					if (oLabel) {
						return oLabel.getText();
					}
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
			}
		}
	});
	_ValidatorMessage.prototype.getValidationErrorControlId = function() {
		return this.validationErrorControlId;
	};

	return Validator;
});
