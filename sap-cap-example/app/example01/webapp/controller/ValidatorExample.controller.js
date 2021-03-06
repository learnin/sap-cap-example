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
				requiredDatePicker: null,
				requiredComboBox: [{
					value: "",
					text: ""
				}, {
					value: "value1",
					text: "text1"
				}],
				selectedKeyOfRequiredComboBox: ""
			}), "inForm");
			this.setModel(new JSONModel({
				requiredLabelInput: "",
				requiredInput: "",
				requiredSelect: [{
					value: "",
					text: ""
				}, {
					value: "value1",
					text: "text1"
				}],
				selectedKeyOfRequiredSelect: "",
				requiredRadioGroup1: "text1",
				requiredRadioGroup2: "text2",
				selectedIndexOfRequiredRadioGroup: -1,
				requiredDatePicker: null,
				requiredCalendar: [{
					startDate: null
				}],
				requiredComboBox: [{
					value: "",
					text: ""
				}, {
					value: "value1",
					text: "text1"
				}],
				selectedKeyOfRequiredComboBox: ""
			}), "outForm");
			this.setModel(new JSONModel({
				requiredInput: ""
			}), "withUI5Validator");
		},
		onValidate: function () {
			const oView = this.getView();
			// console.log(sap.ui.core.LabelEnablement.getReferencingLabels(oView.byId("requiredLabelInputOutForm")));
			// console.log(oView.byId("x").getBinding());
			// console.log(oView.byId("requiredRadioGroupInForm").getBindingPath("selectedIndex"));
			const validator = new Validator();
			validator.removeErrors(oView);

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
