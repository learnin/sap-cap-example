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

			// TODO: requiredCheckBoxCustom は validate 後に一度エラーを解除した後、空にしても必須エラーの赤にならない。
			// 複数のコントロールのフォーカスアウトで複数のコントロールを赤くしないといけない。Validator にTODO記載済み。
			this._validator.registerRequiredValidateFunctionCalledAfterValidate(
				"requiredCheckBoxCustomValidator",
				() => oView.byId("requiredCheckBoxCustom").getItems().some(oCheckBox => oCheckBox.getSelected()),
				oView.byId("requiredCheckBoxCustom").getItems(),
				oView.byId("requiredCheckBoxCustom"),
				{
					isAddMessageOnce: true
				}
			);

			// TODO: もう1例追加する。ラジオボタンでどれか1つを選択必須でかつ「その他」を選んだ場合はInputも必須というチェック。
			// もしかすると、独自バリデーションにしなくても、isRequireをバインド式にしてやればできるかも？できたとしても、それと独自バリデーション版と両方をサンプルに載せる。

			// 必須入力チェック以外のバリデーションは、UI5標準バリデーションと同様にフォーカスアウト時にエラー表示させる。
			this._validator.registerValidateFunctionCalledAfterValidate(
				"toDateIsAfterFromDateValidator",
				() => {
					const dFromDateValue = oView.byId("fromDate").getDateValue();
					const dToDateValue = oView.byId("toDate").getDateValue();
					// 必須チェックは別でやっているのでここでエラーにするのは両方入力されていて値が不正な場合のみ
					return !(dFromDateValue && dToDateValue && dFromDateValue.getTime() > dToDateValue.getTime());
				},
				["From date には To date 以前の日付を入力してください。", "To date には From date 以降の日付を入力してください。"],	// "From date と To dare の大小関係を正しく入力してください" も可能
				[oView.byId("fromDate"), oView.byId("toDate")],
				oView.byId("toDate")
			);

			// TODO: https://github.com/jquense/yup 使えないか？
			// this._validator.builder()
			// 	.target(oView.byId("toDate"))
			// 	.isValid(oToDateControl => {
			// 		const dFromDateValue = oView.byId("fromDate").getDateValue();
			// 		const dToDateValue = oToDateControl.getDateValue();
			// 		return !(dFromDateValue && dToDateValue && dFromDateValue.getTime() > dToDateValue.getTime());
			// 	})
			// 	.message("To date には From date 以降の日付を入力してください。")
			// 	.after(oView.byId("toDate"))
			// 	.build();

			// // TODO: validatorFunctonのidはtargetのid + 連番とかで自動生成できないか？
			// this._validator.builder()
			// 	.target(oView.byId("requiredCheckBoxCustom").getItems())
			// 	.isValid(oControl => !(oControl.getItems().every(oCheckBox => !oCheckBox.getSelected())))
			// 	.after(oView.byId("requiredCheckBoxCustom"))
			// 	.required();
		},
		onValidate: function () {
			const oView = this.getView();
			
			// TODO: Validatorのコンストラクタの引数のオプションObjectにパラメータを追加して、validate時に合わせてaddValidator2Controlsも呼ぶか制御可能にする。デフォルトは呼ぶ。
			// TODO: 挙動としては①1度validateするとフォーカスアウトでバリデーションが効くようになる
			// （正しい値を入れてフォーカスアウトしてエラーが消えてもまた不正にしてフォーカスアウトするとエラーになる）②1度validateするとremoveErrorsするまでエラーは残りっぱなし
			// のどちらかとなる。どちらにするかをValidatorのコンストラクタの引数で選べるようにする。デフォルトは①
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
