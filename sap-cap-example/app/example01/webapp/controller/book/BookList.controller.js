sap.ui.define([
	"../BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/FilterType",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, Filter, FilterOperator, FilterType, JSONModel, MessageToast, MessageBox) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.book.BookList", {
		onInit: function () {
			// コントローラとビューの両方で利用したい状態を保持するモデルをビューにセット
			this.setModel(new JSONModel({
				isBusy: false,
				hasUIChanges: false
			}), "state");

			// ODataモデル（sap.ui.model.odata.v2.ODataModelが使われている）はモデルのjsファイルを書いて定義してそれをnewしてインスタンスを作成するのではなく、
			// manifest.jsonに定義しておくとクラス実装なしでインスタンスを取得可能。

			// manifest.jsonのmodels定義からデフォルトモデル（""で定義されているモデル）を取得
			const oCatalog = this.getOwnerComponent().getModel("catalog");  // デフォルト以外のモデルを取得する際は getModel("xxx")

			// ビューのsap.m.Tableはデフォルトではmanifest.jsonのデフォルトモデル（""で定義されているモデル）にバインディングされる。
			// それ以外のモデルにバインディングしたい場合はセットする
			this.setModel(oCatalog);

			const oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
			this._oMessageModelBinding = oMessageModel.bindList("/", undefined, [], new Filter("technical", FilterOperator.EQ, true));
			this.setModel(oMessageModel, "message");

			this._oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
			this._bTechnicalErrors = false;

			// OData の総データ件数（ページングされる可能性のあるレスポンスデータの件数ではなく、$inlinecount でデータ取得した際に返される __count の値）を表示するための
			// モデルをバインディングしておき、ODataModel のリクエスト完了時にレスポンスの値を取得してセットする。
			// なお、OData V4 なら https://sapui5.hana.ondemand.com/#/topic/77d2310b637b490495d78b393ed6aa64 のように実装できるみたい。
			const oCountModel = new JSONModel({
				count: 0
			});
			this.setModel(oCountModel, "count");
			oCatalog.attachRequestCompleted(this._onRequestCompletedODataModel, this);
		},
		onExit: function () {
			if (this._oMessageModelBinding) {
				this._oMessageModelBinding.detachChange(this.onMessageBindingChange, this);
			}
			this.getModel().detachRequestCompleted(this._onRequestCompletedODataModel, this);
		},
		onNavToBookPage: function (oEvent) {
			// onStockChange のように引数に id を追加するのではなく、以下のように oEvent からバインドコンテキスト経由でバインドされているモデルのプロパティを取得することも可能。
			// ただ、引数に追加した方が利用するプロパティが明確でわかりやすく、コード量も減るのでベターと思われる。
			const oContext = oEvent.getSource().getBindingContext();
			this.navTo("book", { id: oContext.getProperty("ID") });
		},
		onSearch: function () {
			const oView = this.getView();
			const oFilter = new Filter("title", FilterOperator.Contains, oView.byId("searchField").getValue());
			oView.byId("bookList").getBinding("items").filter(oFilter, FilterType.Application);
		},
		onResetChanges: function () {
			this.getModel().resetChanges();
			this._bTechnicalErrors = false; // If there were technical errors, cancelling changes resets them.
			this._setUIChanges(false);
		},
		onSave: function () {
			this._setBusy(true); // Lock UI until submitChanges is resolved.
			this.getModel().submitChanges({
				success: (oData) => {
					this._setBusy(false);
					// console.log(oData.__batchResponses);
					const bHasError = oData.__batchResponses?.some(function (batchResponse) {
						return batchResponse.__changeResponses?.some(function (changeResponse) {
							return (changeResponse.statusCode === undefined && changeResponse.response?.statusCode?.substring(0, 1) !== "2")
								|| changeResponse.statusCode.substring(0, 1) !== "2";
						});
					});
					if (bHasError) {
						MessageBox.error(this.getResourceText("message.changesSentError"));
					} else {
						MessageToast.show(this.getResourceText("message.saved"));
					}
					this._setUIChanges(false);
				},
				error: (oError) => {
					this._setBusy(false);
					this._setUIChanges(false);
					MessageBox.error(oError.message);
				}
			});
			this._bTechnicalErrors = false; // If there were technical errors, a new save resets them.
		},
		/**
		 * Lock UI when changing data in the input controls
		 * @param {sap.ui.base.Event} oEvent - Event data
		 */
		onInputChange: function (oEvent) {
			if (oEvent.getParameter("escPressed")) {
				this._setUIChanges();
			} else {
				this._setUIChanges(true);
			}
		},
		onStockChange: function (oEvent, id) {
			// 文字列型から数値型へ変換（数値型フィールドに文字列型の値のままOData APIに渡すとバックエンドのCDS側でエラーになる）
			// 対応方法は、このようにchangeイベントハンドラで変換するか、保存ボタン押下時の処理でモデルからgetPendingChangesで変更内容を取得して
			// パースして変換してsetPropertyするか

			// TODO: バリデーション
			this.getModel().setProperty(`/Books(${id})/stock`, parseInt(oEvent.getParameters().value, 10));
		},
		onMessageBindingChange: function (oEvent) {
			const aContexts = oEvent.getSource().getContexts();

			if (!aContexts.length) {
				return;
			}
			// Extract and remove the technical messages
			const aMessages = aContexts.map(oContext => oContext.getObject());
			sap.ui.getCore().getMessageManager().removeMessages(aMessages);

			this._setUIChanges(true);
			this._bTechnicalErrors = true;
			MessageBox.error(aMessages[0].message);
		},
		/**
		 * Set hasUIChanges flag in View Model
		 * @param {boolean} [bHasUIChanges] - set or clear hasUIChanges
		 * if hasUIChanges is not set, the hasPendingChanges-function of the OdataV4 model determines the result
		 */
		_setUIChanges: function (bHasUIChanges) {
			if (this._bTechnicalErrors) {
				// If there is currently a technical error, then force 'true'.
				bHasUIChanges = true;
			} else if (bHasUIChanges === undefined) {
				bHasUIChanges = this.getModel().hasPendingChanges();
			}
			this.getModel("state").setProperty("/hasUIChanges", bHasUIChanges);
		},
		/**
		 * Set isBusy flag in View Model
		 * @param {boolean} bIsBusy - set or clear isBusy
		 */
		_setBusy: function (bIsBusy) {
			this.getModel("state").setProperty("/isBusy", bIsBusy);
		},
		_onRequestCompletedODataModel: function (oEvent) {
			if (!oEvent.getParameters().success) {
				return;
			}
			const oResponse = oEvent.getParameters().response;
			if (!oResponse) {
				return;
			}
			const sResponseText = oResponse.responseText;
			if (sResponseText) {
				try {
					const oResponseText = JSON.parse(sResponseText);
					oCountModel.setProperty("/count", oResponseText.d.__count);
				} catch (oError) {
					console.error(oError);
				}
			}
		}
	});
});
