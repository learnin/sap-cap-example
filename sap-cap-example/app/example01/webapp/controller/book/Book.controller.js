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

			// const oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
			// // When the OData service reports errors while writing data, the OData Model adds them to the MessageModel as technical messages. 
			// // cf. https://sapui5.hana.ondemand.com/#/topic/b4f12660538147f8839b05cb03f1d478
			// const oMessageModelBinding = oMessageModel.bindList("/", undefined, [], new Filter("technical", FilterOperator.EQ, true));
			// this.setModel(oMessageModel, "message");
			// oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
			// this._bTechnicalErrors = false;
		},
		// onMessageBindingChange : function (oEvent) {
		// 	var aContexts = oEvent.getSource().getContexts(),
		// 		aMessages,
		// 		bMessageOpen = false;

		// 	if (bMessageOpen || !aContexts.length) {
		// 		return;
		// 	}

		// 	// Extract and remove the technical messages
		// 	aMessages = aContexts.map(function (oContext) {
		// 		return oContext.getObject();
		// 	});
		// 	sap.ui.getCore().getMessageManager().removeMessages(aMessages);

		// 	this._bTechnicalErrors = true;
		// 	MessageBox.error(aMessages[0].message, {
		// 		id : "serviceErrorMessageBox",
		// 		onClose : function () {
		// 			bMessageOpen = false;
		// 		}
		// 	});

		// 	bMessageOpen = true;
		// },
		onEdit: function (oEvent) {
			if (this._isEditing()) {
				return;
			}
			this._showGeneralInformationFragment("BookEditGeneralInformation");
			this._setEditing(true);
		},
		onResetChanges: function () {
			this.getModel().resetChanges();
			this._bTechnicalErrors = false; // If there were technical errors, cancelling changes resets them.
			this._showGeneralInformationFragment("BookDisplayGeneralInformation");
			this._setEditing(false);
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
								console.log(JSON.parse(changeResponse.response.body).error.message.value);
								return true;
							});
						});
					}
					if (bHasError) {
						MessageBox.error(this.getResourceText("changesSentErrorMessage"));
					} else {
						MessageToast.show(this.getResourceText("changesSentMessage"));
						this._showGeneralInformationFragment("BookDisplayGeneralInformation");
						this._setEditing(false);
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

			this._getFragment(sFragmentName).then(function (oControl) {
				oSection.removeAllBlocks();
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
		},
		_isEditing: function() {
			return this.getModel("state").getProperty("/isEditing");
		},
		_setEditing: function(bIsEditing) {
			this.getModel("state").setProperty("/isEditing", bIsEditing);
		}
	});
});
