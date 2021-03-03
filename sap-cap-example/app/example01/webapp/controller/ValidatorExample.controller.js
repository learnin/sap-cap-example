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
				requiredRadio2: "text2",
				selectedOfRequiredRadio1: false,
				selectedOfRequiredRadio2: false,
				requiredRadioGroup1: "text1",
				requiredRadioGroup2: "text2",
				selectedIndexOfRequiredRadioGroup: -1,
				requiredRadioGroup21: "text1",
				requiredRadioGroup22: "text2",
				selectedIndexOfRequiredRadioGroup2: -1,
			}), "inForm");
		},
		onSave: function () {
			const oView = this.getView();
			// console.log(sap.ui.core.LabelEnablement.getReferencingLabels(oView.byId("requiredLabelInputOutForm")));
			// console.log(oView.byId("requiredRadioGroupInForm").getSelectedIndex());
			// console.log(oView.byId("requiredRadioGroupInForm").getBindingPath("selectedIndex"));
			const validator = new Validator();
			validator.removeErrors(oView);

			if (!validator.validate(oView) || this.hasValidationError()) {
				console.log(sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/"));
				this.showValidationErrorMessageDialog();
				return;
			}
		}
	});
});
