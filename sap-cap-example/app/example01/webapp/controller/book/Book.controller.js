sap.ui.define([
	"sap/m/MessageItem",
	"sap/m/MessagePopover",
	"sap/m/MessageToast",
	"sap/ui/core/Element",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"../BaseController"
], function (MessageItem, MessagePopover, MessageToast, Element, Fragment, JSONModel, BaseController) {
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

			const oMessageManager = sap.ui.getCore().getMessageManager();
			oMessageManager.removeAllMessages();
			oMessageManager.registerObject(this.byId("ObjectPageLayout"), true);
			this.setModel(oMessageManager.getMessageModel(), "message");
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
				MessageToast.show(this.getResourceText("message.noChanges"));
				this._showGeneralInformationFragment("BookDisplayGeneralInformation");
				this._setEditing(false);
				return;
			}
			this.submitChanges(oModel).then(oResponse => {
				MessageToast.show(this.getResourceText("message.saved"));
				this._showGeneralInformationFragment("BookDisplayGeneralInformation");
				this._setEditing(false);
			}).catch(oError => this.defaultSubmitChangesErrorHandler(oError, oModel));
		},
		onMessagePopover: function (oEvent) {
			if (!this._oMessagePopover) {
				this._oMessagePopover = this._createMessagePopover();
			}
			this._oMessagePopover.toggle(oEvent.getSource());
		},
		_createMessagePopover: function () {
			const oMessagePopover = new MessagePopover({
				activeTitlePress: oEvent => {
					const oItem = oEvent.getParameter("item");
					const oPage = this.byId("messageHandlingPage");
					const oMessage = oItem.getBindingContext("message").getObject();
					const oControl = Element.registry.get(oMessage.getControlId());

					if (oControl) {
						const domRef = oControl.getDomRef();
						if (domRef) {
							oPage.scrollToElement(domRef, 200, [0, -100]);
						}
						setTimeout(() => oControl.focus(), 300);
					}
				},
				items: {
					path: "message>/",
					template: new MessageItem({
						title: "{message>message}",
						subtitle: "{message>additionalText}",
						activeTitle: { parts: [{ path: 'message>controlIds' }], formatter: (sControlId) => !!sControlId },
						type: "{message>type}"
					})
				}
			});
			this.byId("messagePopoverButton").addDependent(oMessagePopover);
			return oMessagePopover;
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
		_isEditing: function () {
			return this.getModel("state").getProperty("/isEditing");
		},
		_setEditing: function (bIsEditing) {
			this.getModel("state").setProperty("/isEditing", bIsEditing);
		}
	});
});
