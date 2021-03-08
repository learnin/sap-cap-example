sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"./BaseController",
	"../validator/Validator",
], function (JSONModel, BaseController, Validator) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.ValidatorExample", {
		onInit: function() {
			this.setModel(new JSONModel({
				requiredLabelInput: "",
				requiredInput: "",
				requiredMaskInput: undefined,
				requiredSelect: [{
					value: "",
					text: ""
				}, {
					value: "value1",
					text: "text1"
				}],
				selectedKeyOfRequiredSelect: "",
				requiredRadio1: "text1",
				selectedOfRequiredRadio1: false,
				requiredRadioGroup1: "text1",
				requiredRadioGroup2: "text2",
				selectedIndexOfRequiredRadioGroup: -1,
				selectedOfRequiredCheckBox: false,
				requiredCheckBoxWithValue: [{
					value: "value1",
					text: "text1"
				}, {
					value: "value2",
					text: "text2"
				}],
				requiredDatePicker: null,
				requiredComboBox: [{
					value: "value1",
					text: "text1"
				}, {
					value: "value2",
					text: "text2"
				}],
				selectedKeyOfRequiredComboBox: "",
				requiredMultiComboBox: [{
					value: "value1",
					text: "text1"
				}, {
					value: "value2",
					text: "text2"
				}],
				selectedKeyOfRequiredMultiComboBox: [],
				requiredTextArea: ""
			}), "inForm");
			this.setModel(new JSONModel({
				requiredInput: "",
				requiredCalendar: [{
					startDate: null
				}],
				requiredCalendarDateInterval: [{
					startDate: null
				}]
			}), "outForm");
			this.setModel(new JSONModel({
				requiredInput: ""
			}), "withUI5Validator");
			this.setModel(new JSONModel({
				requiredCheckBox: [{
					text: "text1"
				}, {
					text: "text2"
				}]
			}), "custom");
		},
		onValidate: function () {
			const oView = this.getView();
			// console.log(sap.ui.core.LabelEnablement.getReferencingLabels(oView.byId("requiredLabelInputOutForm")));
			// console.log(oView.byId("requiredCheckBoxCustom").getItems());
			// console.log(oView.byId("requiredRadioGroupInForm").getBindingPath("selectedIndex"));
			const validator = new Validator();
			validator.removeErrors(oView);

			validator.attachAfterValidate(oView.byId("requiredCheckBoxCustom").getId(), oControl => {
				if (oControl.getItems().every(oCheckBox => !oCheckBox.getSelected())) {
					validator.setRequiredError(oControl.getItems());
					return false;
				}
				return true;
			});

			if (!validator.validate(oView) || this.hasValidationError()) {
				// sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/").forEach(m => console.log(m.getTarget()));
				this.showValidationErrorMessageDialog();
				return;
			}
		},
		onClearErrors: function () {
			new Validator().removeErrors(this.getView());
		}
	});
});
