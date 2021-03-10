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
				requiredTimePicker: null,
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
				requiredTextArea: "",
				requiredFileUploader: "",
				requiredRatingIndicator: 0,
				requiredSearchField: ""
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
			this.setModel(new JSONModel({
				fromDate: null,
				toDate: null
			}), "correlation");
		},
		onValidate: function () {
			const oView = this.getView();
			// console.log(sap.ui.core.LabelEnablement.getReferencingLabels(oView.byId("requiredLabelInputOutForm")));
			// console.log(oView.byId("requiredCheckBoxCustom").getItems());
			// console.log(oView.byId("requiredRadioGroupInForm").getBindingPath("selectedIndex"));
			const validator = new Validator();

			validator.attachAfterValidate(oView.byId("requiredCheckBoxCustom").getId(), oControl => {
				if (oControl.getItems().every(oCheckBox => !oCheckBox.getSelected())) {
					validator.setRequiredError(oControl.getItems());
					return false;
				}
				return true;
			}).attachAfterValidate(oView.byId("toDate").getId(), oToDateControl => {
				const dFromDateValue = oView.byId("fromDate").getDateValue();
				const dToDateValue = oToDateControl.getDateValue();
				if (dFromDateValue && dToDateValue && dFromDateValue.getTime() > dToDateValue.getTime()) {
					validator.setError(oToDateControl, "To date には From date 以降の日付を入力してください。", (oControl, oEvent) => {
						const dFromDateValue = oView.byId("fromDate").getDateValue();
						const dToDateValue = oControl.getDateValue();
						return dFromDateValue && dToDateValue && dFromDateValue.getTime() <= dToDateValue.getTime();
					});
					return false;
				}
				return true;
			});

			// validateでエラー発生時にコントロールのイベントにattachする方式をやめ、
			// validator.attachEventHandlers(oView) で、配下の必須チェック対象とattachAfterValidate対象すべてに事前にattachするようにできないか？
			// attachした際に各コントロールにdata-validatorのような属性データを追加しておき、複数回呼ばれた際はそれで追加済かどうか判断する。

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
