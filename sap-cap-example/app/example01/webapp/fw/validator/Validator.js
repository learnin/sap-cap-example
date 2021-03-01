sap.ui.define([
	"sap/m/CheckBox",
	"sap/m/Input",
	"sap/m/Select",
	"sap/ui/base/Object",
	"sap/ui/core/message/ControlMessageProcessor",
	"sap/ui/core/message/Message",
	"sap/ui/core/MessageType",
	"sap/ui/core/ValueState"
], function (
	CheckBox,
	Input,
	Select,
	BaseObject,
	ControlMessageProcessor,
	Message,
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
			this._removeErrors(oControl);
		}

		// TODO: 相関バリデーションをアプリで実装した際にバリデートエラー時に呼べるaddMessage系のメソッドを用意する

		_removeErrors(oControl) {
			if (this._isValidationTarget(oControl)) {
				this._removeMessagesAndValueState(oControl);
			} else {
				// 入力コントロールやエレメントでなかった場合は、aggregation のコントロールやエレメントを再帰的に処理する。
				for (let i = 0; i < this._aTargetAggregations.length; i++) {
					const aControlAggregation = oControl.getAggregation(this._aTargetAggregations[i]);
					if (!aControlAggregation) {
						continue;
					}
					if (Array.isArray(aControlAggregation)) {
						for (let j = 0; j < aControlAggregation.length; j++) {
							this._removeErrors(aControlAggregation[j]);
						}
					} else {
						this._removeErrors(aControlAggregation);
					}
				}
			}
		}

		_removeMessagesAndValueState(oControl) {
			const oMessageManager = sap.ui.getCore().getMessageManager();
			const oMessageModel = oMessageManager.getMessageModel();
			const sTarget = this._resolveMessageTarget(oControl);

			const oMessage = oMessageModel.getProperty("/").find(oMsg =>
				BaseObject.isA(oMsg.getMessageProcessor(), _ValidatorMessageProcessor.getMetadata().getName()) && oMsg.getTarget() === sTarget);
			if (oMessage) {
				oMessageManager.removeMessages(oMessage);
			}
			// 不正な値を入力された場合、標準のバリデーションによりエラーステートがセットされている可能性があるため、
			// エラーメッセージがまだあるか確認し、ない場合にのみエラーステートをクリアする。
			if (oControl.setValueState &&
				!oMessageModel.getProperty("/").find(oMsg => oMsg.getTarget() === sTarget)) {
				this._setValueState(oControl, ValueState.None, null);
			}
		}

		_isValidationTarget(oControl) {
			return oControl.getRequired && oControl.getRequired() === true && oControl.getEnabled && oControl.getEnabled() === true;
		}

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

			// TODO: 例えばsap.m.CheckBox（getSelected）、sap.ui.unified.FileUploader（value）、sap.m.RadioButton（getSelected）、
			// sap.m.RadioButtonGroup（getSelectedIndex）、sap.ui.unified.Calendar（getSelectedDates）には
			// requiredはないので対応していないが、LabelのlabelForをたどることでチェックできそう
			if (this._isValidationTarget(oControl)) {
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

		_resolveMessageTarget(oControl) {
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
					this._removeMessagesAndValueState(oControl);
				};
				oControl.attachChange(fnOnChange);
			}
			return false;
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
			sap.ui.getCore().getMessageManager().addMessages(new Message({
				message: sMessageText,
				type: MessageType.Error,
				additionalText: this._getLabelText(oControl),
				processor: new _ValidatorMessageProcessor(),
				target: this._resolveMessageTarget(oControl)
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
	 * Validator で MseesageManager からメッセージを削除する際に、
	 * Validator で追加したメッセージを判別可能とするためにメッセージにセットする MessageProcessor。
	 * 処理内容は、{@link sap.ui.core.message.ControlMessageProcessor ControlMessageProcessor} と同一。
	 */
	const _ValidatorMessageProcessor = ControlMessageProcessor.extend("fw.validator.Validator._ValidatorMessageProcessor", {
	});

	return Validator;
});
