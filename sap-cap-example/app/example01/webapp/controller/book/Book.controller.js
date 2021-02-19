sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"../BaseController"
], function (MessageBox, MessageToast, Fragment, JSONModel, BaseController) {
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
		},
		onEdit: function (oEvent) {
			if (this._isEditing()) {
				return;
			}
			this._showGeneralInformationFragment("BookEditGeneralInformation");
			this._setEditing(true);
		},
		onResetChanges: function () {
			this.getModel().resetChanges();
			this._showGeneralInformationFragment("BookDisplayGeneralInformation");
			this._setEditing(false);
		},
		onSave: function () {
			const oModel = this.getModel();
			if (!oModel.hasPendingChanges()) {
				MessageToast.show(this.getResourceText("app.message.noChanges"));
				this._showGeneralInformationFragment("BookDisplayGeneralInformation");
				this._setEditing(false);
				return;
			}
			this.submitChanges(oModel).then(oResponse => {
				MessageToast.show(this.getResourceText("app.message.saved"));
				this._showGeneralInformationFragment("BookDisplayGeneralInformation");
				this._setEditing(false);
			}).catch((error) => {
				if (error instanceof ConcurrentModificationError) {
					this.showConcurrentModificationErrorMessageDialog(oModel);
					return;
				}
				let sMessage = error.message;
				const aMessages = error.getMessageStrings();
				if (aMessages.length > 0) {
					sMessage = aMessages.join("\n");
				}
				MessageBox.error(sMessage);
			});
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
