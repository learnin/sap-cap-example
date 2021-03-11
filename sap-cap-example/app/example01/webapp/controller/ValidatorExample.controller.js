sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"./BaseController",
	"../validator/Validator",
], function (JSONModel, BaseController, Validator) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.ValidatorExample", {
		onInit: function () {
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

			this._validator = new Validator();
		},
		onAfterRendering: function () {
			const oView = this.getView();

			// 必須入力チェック以外のバリデーションは、UI5標準バリデーションと同様にフォーカスアウト時にエラー表示させたい。
			this._validator.registerValidateFunctionCalledAfterValidate(
				"toDateIsAfterFromDateValidator",
				oToDateControl => {
					const dFromDateValue = oView.byId("fromDate").getDateValue();
					const dToDateValue = oToDateControl.getDateValue();
					if (dFromDateValue && dToDateValue && dFromDateValue.getTime() > dToDateValue.getTime()) {
						this._validator.setError(oToDateControl, "To date には From date 以降の日付を入力してください。", (oControl, oEvent) => {
							const dFromDateValue = oView.byId("fromDate").getDateValue();
							const dToDateValue = oControl.getDateValue();
							return dFromDateValue && dToDateValue && dFromDateValue.getTime() <= dToDateValue.getTime();
						});
						return false;
					}
					return true;
				},
				oView.byId("toDate")
			);
			// TODO: フォーカスアウト時の必須入力チェックは保存ボタンを押すまでは仕掛けたくないので、この時点で toDateIsAfterFromDateValidator だけを
			// フォーカスアウト時のバリデーション対象にできるようなAPIがほしい。
			// -> registerValidateFunctionCalledAfterValidate の引数にオプションObjectを追加してそれでtrueにすれば同時にattachするようにする
		},
		onValidate: function () {
			const oView = this.getView();
			
			this._validator.registerValidateFunctionCalledAfterValidate(
				"requiredCheckBoxCustomValidator",
				oControl => {
					if (oControl.getItems().every(oCheckBox => !oCheckBox.getSelected())) {
						this._validator.setRequiredError(oControl.getItems());
						return false;
					}
					return true;
				},
				oView.byId("requiredCheckBoxCustom")
			);

			// TODO: registerValidateFunctionCalledAfterValidate で追加された関数によるフォーカスアウト時のバリデーションの追加
			// TODO: Validatorのコンストラクタの引数のオプションObjectにパラメータを追加して、validate時に合わせてaddValidator2Controlsも呼ぶか制御可能にする。デフォルトは呼ぶ。
			// TODO: validate実行時にattachするのは廃止する。挙動としては①1度validateするとフォーカスアウトでバリデーションが効くようになる
			// （正しい値を入れてフォーカスアウトしてエラーが消えてもまた不正にしてフォーカスアウトするとエラーになる）②1度validateするとremoveErrorsするまでエラーは残りっぱなし
			// のどちらかとなる。
			this._validator.addValidator2Controls(oView);

			// TODO: テーブルのセルのバリデーション

			this._validator.removeErrors(oView);

			if (!this._validator.validate(oView) || this.hasValidationError()) {
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
