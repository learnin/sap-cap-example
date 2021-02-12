sap.ui.define([
	"com/example/example01/controller/BaseController",
	"sap/ui/core/Fragment",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/FilterType",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, Fragment, Filter, FilterOperator, FilterType, JSONModel, MessageToast, MessageBox) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.book.Book", {
		onInit: function () {
			this.setModel(new JSONModel({
				isEditing: false
			}), "state");

			const oCatalog = this.getOwnerComponent().getModel("catalog");
			this.setModel(oCatalog);

			this.getRouter().getRoute("book").attachMatched(this._onRouteMatched, this);

			this._oFragmentsCache = {};
			this._showGeneralInformationFragment("BookDisplayGeneralInformation");

			// const oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
			// const oMessageModelBinding = oMessageModel.bindList("/", undefined, [], new Filter("technical", FilterOperator.EQ, true));
			// this.setModel(oMessageModel, "message");

			// oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
			// this._bTechnicalErrors = false;
		},
		onStockChange: function (oEvent, id) {
			// 文字列型から数値型へ変換（数値型フィールドに文字列型の値のままOData APIに渡すとバックエンドのCDS側でエラーになる）
			// 対応方法は、このようにchangeイベントハンドラで変換するか、保存ボタン押下時の処理でモデルからgetPendingChangesで変更内容を取得して
			// パースして変換してsetPropertyするか

			// TODO: バリデーション
			this.getModel().setProperty(`/Books(${id})/stock`, parseInt(oEvent.getParameters().value, 10));
		},
		onEdit: function (oEvent) {
			this._showGeneralInformationFragment("BookEditGeneralInformation");
			this.getModel("state").setProperty("/isEditing", true);
		},
		onResetChanges: function () {
			this.getModel().resetChanges();
			this._bTechnicalErrors = false; // If there were technical errors, cancelling changes resets them.
			this.getModel("state").setProperty("/isEditing", false);
			this._showGeneralInformationFragment("BookDisplayGeneralInformation");
		},
		onSave: function () {
			this.getModel().submitChanges({
				success: (oData) => {
					let bHasError = false;
					if (!oData.__batchResponses) {
						bHasError = true;
					} else {
						bHasError = oData.__batchResponses.some(function (batchResponse) {
							if (!batchResponse.__changeResponses) {
								return true;
							}
							return batchResponse.__changeResponses.some(function (changeResponse) {
								if ((changeResponse.statusCode && changeResponse.statusCode.substring(0, 1) === "2")
									|| (changeResponse.response && changeResponse.response.statusCode && changeResponse.response.statusCode.substring(0, 1) === "2")) {
									return false;
								}
								return true;
							});
						});
					}
					if (bHasError) {
						MessageBox.error(this.getResourceText("changesSentErrorMessage"));
					} else {
						MessageToast.show(this.getResourceText("changesSentMessage"));
						this.getModel("state").setProperty("/isEditing", false);
						this._showGeneralInformationFragment("BookDisplayGeneralInformation");
					}
				},
				error: (oError) => {
					MessageBox.error(oError.message);
				}
			});
			this._bTechnicalErrors = false; // If there were technical errors, a new save resets them.
		},
		_onRouteMatched: function (oEvent) {
			const oView = this.getView();

			oView.bindElement({
				path: `/Books(${oEvent.getParameter("arguments").id})`,
				// sap.ui.model.Binding のイベント
				events: {
					// バインディングデータが変更された場合
					change: (oEvent) => {
						if (!this.getView().getBindingContext()) {
							// URLパスに存在しないidを指定された場合等、コンテキストがない場合は notFound 画面を表示する
							this.getRouter().getTargets().display("notFound");
						}
					},
					dataRequested: function (oEvent) {
						oView.setBusy(true);
					},
					dataReceived: function (oEvent) {
						oView.setBusy(false);
					}
				}
			});
		},
		_showGeneralInformationFragment: function (sFragmentName) {
			const oSection = this.byId("generalInformationSubSection");

			oSection.removeAllBlocks();
			this._getFragment(sFragmentName).then(function (oControl) {
				oSection.addBlock(oControl);
			});
		},
		_getFragment: function (sFragmentName) {
			let pFragment = this._oFragmentsCache[sFragmentName];

			if (!pFragment) {
				// 戻り値は Promise
				pFragment = Fragment.load({
					id: this.getView().getId(),
					name: "com.example.example01.view.book." + sFragmentName,
					controller: this
				});
				this._oFragmentsCache[sFragmentName] = pFragment;
			}
			return pFragment;
		}
	});
});
