sap.ui.define([
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel",
	"../../validator/Validator",
	"../BaseController"
], function (MessageToast, Fragment, JSONModel, Validator, BaseController) {
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

			this._validator = new Validator();

			// manifest.json で sap.ui5.handleValidation を true にしている場合は不要 cf. https://sapui5.hana.ondemand.com/#/topic/a90d93df5a024e8bb18826b699c9aaa7.html
			// oMessageManager.registerObject(this.getView(), true);
		},
		onExit: function () {
			this.getRouter().getRoute("book").detachMatched(this._onRouteMatched, this);
			this._validator.removeAttachedValidators(this.getView());
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

			this._validator.removeErrors(this.getView());
		},
		onSave: function () {
			const oView = this.getView();
			this._validator.removeErrors(oView);
			this.removeAllTechnicalMessages();

			if (!this._validator.validate(oView) || this.hasErrorMessages()) {
				this.showValidationErrorMessageDialog();
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
		_onRouteMatched: function (oEvent) {
			// TODO: 画面遷移してきた時に、他の画面で登録されたエラーメッセージが残っているかもしれないので全クリアが必要

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
