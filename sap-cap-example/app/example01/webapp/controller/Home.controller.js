sap.ui.define([
	"com/example/example01/controller/BaseController"
], function (BaseController) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.Home", {

		onDisplayNotFound: function () {
			// display the "notFound" target without changing the hash
			this.getRouter().getTargets().display("notFound", {
				fromTarget: "home"
			});
		},
		onNavToBookList: function () {
			this.getRouter().navTo("bookList");
		},
		onGetBooksFromOData: function () {
			// データモデルをビューのコンポーネントのバインディングで自動利用する以外に、プログラマティックにOData API呼び出しを行うことも可能
			const catalog = this.getOwnerComponent().getModel("catalog");
			console.log(catalog.getServiceMetadata());
			catalog.read("/Books", {
				success: (oData, response) => {
					sap.m.MessageToast.show(JSON.stringify(oData));
				}, error: (error) => {
					console.log(error);
				}
			});
		}
	});
});
