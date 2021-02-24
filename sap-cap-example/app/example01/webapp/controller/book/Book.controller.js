sap.ui.define([
	"sap/m/Bar",
	"sap/m/Button",
	"sap/m/Dialog",
	"sap/m/MessageItem",
	"sap/m/MessagePopover",
	"sap/m/MessageToast",
	"sap/m/MessageView",
	"sap/m/Text",
	"sap/ui/core/Element",
	"sap/ui/core/Fragment",
	"sap/ui/core/IconPool",
	"sap/ui/core/ValueState",
	"sap/ui/model/json/JSONModel",
	"../BaseController"
], function (Bar, Button, Dialog, MessageItem, MessagePopover, MessageToast, MessageView, Text, Element, Fragment, IconPool, ValueState, JSONModel, BaseController) {
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
			if (this._hasValidateError()) {
				this._showValidationErrorMessageDialog({});
				return;
			}

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
		/**
		 * バリデーションエラー時のメッセージダイアログを表示する。
		 * 
		 * @public
		 * @param {Object} [mDialogParameter] sap.m.Dialog のパラメータ
		 */
		_showValidationErrorMessageDialog: function (mDialogParameter) {
			const oBackButton = new Button({
				icon: IconPool.getIconURI("nav-back"),
				press: function () {
					oMessageView.navigateBack();
					this.setVisible(false);
				}
			});

			const oDefaultDialogParam = {
				draggable: true,
				state: ValueState.Error,
				beginButton: new Button({
					text: this.getResourceBundle("fwI18n").getText("fw.label.cancel"),
					press: function () {
						this.getParent().close();
					}
				}),
				customHeader: new Bar({
					contentLeft: oBackButton,
					contentMiddle: new Text({ text: this.getResourceText("label.validationMessages") })
				}),
				contentHeight: "400px",
				contentWidth: "460px",
				verticalScrolling: false
			};
			const oDialogParam = { ...oDefaultDialogParam, ...mDialogParameter };
			const oDialog = new Dialog(oDialogParam);

			const oMessageView = new MessageView({
				showDetailsPageHeader: false,
				itemSelect: function () {
					oBackButton.setVisible(true);
				},
				listSelect: function () {
					oBackButton.setVisible(false);
				},
				activeTitlePress: oEvent => {
					const oMessage = oEvent.getParameters().item.getBindingContext().getObject();
					const oControl = Element.registry.get(oMessage.getControlId());

					if (oControl) {
						const domRef = oControl.getDomRef();
						if (domRef) {
							this.byId("messageHandlingPage").scrollToElement(domRef, 200, [0, -100]);
						}
						oDialog.close();
						setTimeout(() => oControl.focus(), 300);
					}
				},
				items: {
					path: "/",
					template: new MessageItem({
						title: "{message}",
						subtitle: "{additionalText}",
						activeTitle: "{= ${controlIds}.length > 0}",
						type: "{type}",
						description: "{description}"
					})
				}
			});
			oMessageView.setModel(this.getModel("message"));

			oDialog.addContent(oMessageView);
			oMessageView.navigateBack();
			oDialog.open();
		},
		_hasValidateError: function () {
			return this.getModel("message").getProperty("/").length > 0;
		},
		_createMessagePopover: function () {
			const oMessagePopover = new MessagePopover({
				activeTitlePress: oEvent => {
					const oMessage = oEvent.getParameters().item.getBindingContext("message").getObject();
					const oControl = Element.registry.get(oMessage.getControlId());

					if (oControl) {
						const domRef = oControl.getDomRef();
						if (domRef) {
							this.byId("messageHandlingPage").scrollToElement(domRef, 200, [0, -100]);
						}
						setTimeout(() => oControl.focus(), 300);
					}
				},
				items: {
					path: "message>/",
					template: new MessageItem({
						title: "{message>message}",
						subtitle: "{message>additionalText}",
						activeTitle: "{= ${message>controlIds}.length > 0}",
						type: "{message>type}",
						description: "{message>description}"
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
