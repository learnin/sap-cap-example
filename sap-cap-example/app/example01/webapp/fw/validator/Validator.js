sap.ui.define([
	"sap/ui/core/message/Message",
	"sap/ui/core/MessageType",
	"sap/ui/core/ValueState"
], function (Message, MessageType, ValueState) {
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
		 */
		constructor() {
			this._aPossibleAggregations = [
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
			// sap.m.InputBaseにrequiredとvalueがあるので、サブクラス
			// （sap.ca.ui.DatePicker sap.m.ComboBoxTextField sap.m.DateTimeField sap.m.Input sap.m.MaskInput sap.m.TextArea）は"value"でOK。
			// sap.m.ComboBox sap.m.MultiComboBoxもsap.m.InputBaseが親にいるので同じ。
			// sap.m.SelectにrequiredとselectedKeyがある。
			// "text"はいらないかも。
			this._aValidateProperties = ["value", "selectedKey", "text"];
		}

		/**
		 * 引数のコントロール配下のフィールドのバリデーションを行う。
		 *
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
		 * @returns {boolean} true: valid、false: invalid
		 */
		validate(oControl) {
			return this._validate(oControl);
		}

		/**
		 * Clear the value state of all the controls
		 * @memberof nl.qualiture.plunk.demo.utils.Validator
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 */
		clearValueState(oControl) {
			if (!oControl) return;

			if (oControl.setValueState) oControl.setValueState(ValueState.None);

			this._recursiveCall(oControl, this.clearValueState);
		}

		/**
		 * 引数のコントロール配下のフィールドのバリデーションを行う。
		 *
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
		 * @returns {boolean}　true: valid、false: invalid
		 */
		_validate(oControl) {
			// let i = 0;
			let isValidatedControl = true;
			let isValid = true;

			if (!((oControl instanceof sap.ui.core.Control ||
				oControl instanceof sap.ui.layout.form.FormContainer ||
				oControl instanceof sap.ui.layout.form.FormElement ||
				oControl instanceof sap.m.IconTabFilter) &&
				oControl.getVisible())) {
				return true;
			}

			// TODO: 例えばsap.m.CheckBox（getPartiallySelectedかgetSelected）、sap.ui.unified.FileUploader（value）、sap.m.RadioButton（getSelected）、
			// sap.m.RadioButtonGroup（getSelectedIndex）、sap.ui.unified.Calendar（getSelectedDates）には
			// requiredはないので対応していないが、LabelのlabelForをたどることでチェックできそう
			if (oControl.getRequired && oControl.getRequired() === true &&
				oControl.getEnabled && oControl.getEnabled() === true) {
				isValid = this._validateRequired(oControl);
			// 必須チェック以外は、標準のバリデーションがonChangeで動くのでそれに任せればいいはず
			// } else if ((i = this._hasType(oControl)) !== -1 && oControl.getEnabled && oControl.getEnabled() === true) {
			// 	// Control constraints
			// 	isValid = this._validateConstraint(oControl, i);
			// } else if (oControl.getValueState && oControl.getValueState() === ValueState.Error) {
			// 	// Control custom validation
			// 	isValid = false;
			// 	this._setValueState(oControl, ValueState.Error, "Wrong input");
			} else {
				isValidatedControl = false;
			}

			if (!isValid) {
				this._addMessage(oControl);
			}

			if (!isValidatedControl) {
				if (!this._recursiveValidate(oControl, this._validate)) {
					isValid = false;
				}
			}
			return isValid;
		}

		_resolveMessageTarget(oControl) {
			if (oControl.getBindingPath("value")) {
				return oControl.getId() + "/value";
			}
			if (oControl.getBindingPath("selectedKey")) {
				return oControl.getId() + "/selectedKey";
			}
			return undefined;
		}

		/**
		 * 引数のコントロールやエレメントの必須チェックを行う。
		 *
		 * @param {sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement} oControl 検証対象のコントロールやエレメント
		 * @returns {boolean}　true: valid、false: invalid
		 */
		_validateRequired(oControl) {
			// check control for any properties worth validating
			var isValid = true;

			for (var i = 0; i < this._aValidateProperties.length; i += 1) {
				try {
					oControl.getBinding(this._aValidateProperties[i]);
					// FIXME APIドキュメントにgetPropertyではなくgetValue等getXxxを使うように書かれている
					var oExternalValue = oControl.getProperty(
						this._aValidateProperties[i]
					);

					if (!oExternalValue || oExternalValue === "") {
						this._setValueState(
							oControl,
							ValueState.Error,
							"Please fill this mandatory field!"
						);
						isValid = false;
						if (oControl.attachChange) {
							// ValueState とエラーメッセージが残ったままにならないように、対象のコントロールの change イベントで ValueState とエラーメッセージを除去する。
							const fnOnChange = oEvent => {
								oControl.detachChange(fnOnChange);

								const oMessageManager = sap.ui.getCore().getMessageManager();
								const oMessageModel = oMessageManager.getMessageModel();
								const sTarget = this._resolveMessageTarget(oControl);
								const oMessage = oMessageModel.getProperty("/").find(oMsg => oMsg.getMessageProcessor() === undefined && oMsg.getTarget() === sTarget);
								if (oMessage) {
									oMessageManager.removeMessages(oMessage);
								}
								// 不正な値を入力された場合、標準のバリデーションによりエラーステートがセットされている可能性があるため、
								// エラーメッセージがまだあるか確認し、ない場合にのみエラーステートをクリアする。
								if (oControl.setValueState &&
									!oMessageModel.getProperty("/").find(oMsg => oMsg.getMessageProcessor() && oMsg.getTarget() === sTarget)) {
									oControl.setValueState(ValueState.None);
								}
							};
							oControl.attachChange(fnOnChange);
						}
					} else if (
						oControl.getAggregation("picker") &&
						oControl.getProperty("selectedKey").length === 0
					) {
						// might be a select
						this._setValueState(
							oControl,
							ValueState.Error,
							"Please choose an entry!"
						);
						isValid = false;
					} else {
						isValid = true;
						break;
					}
				} catch (ex) {
					// Validation failed
				}
			}
			return isValid;
		}

		// /**
		//  * Check if the control is required
		//  * @memberof nl.qualiture.plunk.demo.utils.Validator
		//  *
		//  * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		//  * @param {int} i - The index of the property
		//  * @return {bool} - If the property is valid
		//  */
		// _validateConstraint(oControl, i) {
		// 	var isValid = true;

		// 	try {
		// 		var editable = oControl.getProperty("editable");
		// 	} catch (ex) {
		// 		editable = true;
		// 	}

		// 	if (editable) {
		// 		try {
		// 			// try validating the bound value
		// 			var oControlBinding = oControl.getBinding(
		// 				this._aValidateProperties[i]
		// 			);
		// 			var oExternalValue = oControl.getProperty(
		// 				this._aValidateProperties[i]
		// 			);
		// 			var oInternalValue = oControlBinding
		// 				.getType()
		// 				.parseValue(oExternalValue, oControlBinding.sInternalType);
		// 			oControlBinding.getType().validateValue(oInternalValue);
		// 			oControl.setValueState(ValueState.None);
		// 		} catch (ex) {
		// 			// catch any validation errors
		// 			isValid = false;
		// 			this._setValueState(oControl, ValueState.Error, ex.message);
		// 		}
		// 	}
		// 	return isValid;
		// }

		/**
		 * Add message to the MessageManager
		 * @memberof nl.qualiture.plunk.demo.utils.Validator
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @param {string} sMessage - Customize the message
		 */
		_addMessage(oControl, sMessage) {
			var sLabel,
				eMessageType = MessageType.Error;

			if (sMessage === undefined) sMessage = "Wrong input"; // Default message

			switch (oControl.getMetadata().getName()) {
				case "sap.m.CheckBox":
				case "sap.m.Input":
				case "sap.m.Select":
					sLabel = oControl
						.getParent()
						.getLabel()
						.getText();
					break;
			}

			if (oControl.getValueState)
				eMessageType = this._convertValueStateToMessageType(
					oControl.getValueState()
				);

			sap.ui
				.getCore()
				.getMessageManager()
				.addMessages(
					new Message({
						message: oControl.getValueStateText
							? oControl.getValueStateText()
							: sMessage, // Get Message from ValueStateText if available
						type: eMessageType,
						additionalText: sLabel, // Get label from the form element
						target: this._resolveMessageTarget(oControl)
					})
				);
		}

		// /**
		//  * Check if the control property has a data type, then returns the index of the property to validate
		//  * @memberof nl.qualiture.plunk.demo.utils.Validator
		//  *
		//  * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		//  * @return {int} i - The index of the property to validate
		//  */
		// _hasType(oControl) {
		// 	// check if a data type exists (which may have validation constraints)
		// 	for (var i = 0; i < this._aValidateProperties.length; i += 1) {
		// 		if (
		// 			oControl.getBinding(this._aValidateProperties[i]) &&
		// 			oControl.getBinding(this._aValidateProperties[i]).getType()
		// 		)
		// 			return i;
		// 	}
		// 	return -1;
		// }

		/**
		 * Set ValueState and ValueStateText of the control
		 * @memberof nl.qualiture.plunk.demo.utils.Validator
		 *
		 * @param {sap.ui.core.ValueState} oValueState - The ValueState to be set
		 * @param {string} sText - The ValueStateText to be set
		 */
		_setValueState(oControl, oValueState, sText) {
			oControl.setValueState(oValueState);
			if (oControl.getValueStateText && !oControl.getValueStateText()) {
				oControl.setValueStateText(sText);
			}
		}

		/**
		 * Recursively calls the function on all the children of the aggregation
		 * @memberof nl.qualiture.plunk.demo.utils.Validator
		 *
		 * @param {(sap.ui.core.Control|sap.ui.layout.form.FormContainer|sap.ui.layout.form.FormElement)} oControl - The control or element to be validated.
		 * @param {function} fFunction - The function to call recursively
		 */
		_recursiveCall(oControl, fFunction) {
			for (var i = 0; i < this._aPossibleAggregations.length; i += 1) {
				var aControlAggregation = oControl.getAggregation(
					this._aPossibleAggregations[i]
				);

				if (!aControlAggregation) continue;

				if (aControlAggregation instanceof Array) {
					// generally, aggregations are of type Array
					for (var j = 0; j < aControlAggregation.length; j += 1) {
						fFunction.call(this, aControlAggregation[j]);
					}
				} else {
					// ...however, with sap.ui.layout.form.Form, it is a single object *sigh*
					fFunction.call(this, aControlAggregation);
				}
			}
		}

		_recursiveValidate(oControl, fFunction) {
			let isValid = true;

			for (var i = 0; i < this._aPossibleAggregations.length; i += 1) {
				var aControlAggregation = oControl.getAggregation(
					this._aPossibleAggregations[i]
				);

				if (!aControlAggregation) continue;

				if (aControlAggregation instanceof Array) {
					// generally, aggregations are of type Array
					for (var j = 0; j < aControlAggregation.length; j += 1) {
						if (!fFunction.call(this, aControlAggregation[j])) {
							isValid = false;
						}
					}
				} else {
					// ...however, with sap.ui.layout.form.Form, it is a single object *sigh*
					if (!fFunction.call(this, aControlAggregation)) {
						isValid = false;
					}
				}
			}
			return isValid;
		}

		/**
		 * Recursively calls the function on all the children of the aggregation
		 * @memberof nl.qualiture.plunk.demo.utils.Validator
		 *
		 * @param {sap.ui.core.ValueState} eValueState
		 * @return {sap.ui.core.MessageType} eMessageType
		 */
		_convertValueStateToMessageType(eValueState) {
			var eMessageType;

			switch (eValueState) {
				case ValueState.Error:
					eMessageType = MessageType.Error;
					break;
				case ValueState.Information:
					eMessageType = MessageType.Information;
					break;
				case ValueState.None:
					eMessageType = MessageType.None;
					break;
				case ValueState.Success:
					eMessageType = MessageType.Success;
					break;
				case ValueState.Warning:
					eMessageType = MessageType.Warning;
					break;
				default:
					eMessageType = MessageType.Error;
			}
			return eMessageType;
		}

	}
	return Validator;
});
