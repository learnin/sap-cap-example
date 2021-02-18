sap.ui.define([
	"sap/m/Bar",
	"sap/m/Button",
	"sap/m/ButtonType",
	"sap/m/Dialog",
	"sap/m/MessageBox",
	"sap/m/MessageItem",
	"sap/m/MessageView",
	"sap/m/Text",
	"sap/ui/base/Object",
	"sap/ui/core/message/Message",
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/ui/core/IconPool",
	"sap/ui/core/UIComponent",
	"sap/ui/core/ValueState",
	"com/example/example01/model/formatter"
], function (
	Bar,
	Button,
	ButtonType,
	Dialog,
	MessageBox,
	MessageItem,
	MessageView,
	Text,
	BaseObject,
	Message,
	Controller,
	History,
	IconPool,
	UIComponent,
	ValueState,
	formatter) {
	"use strict";

	return Controller.extend("com.example.example01.controller.BaseController", {

		formatter: formatter,

		/**
		 * Convenience method for getting the view model by name in every controller of the application.
		 * @public
		 * @param {string} sName the model name
		 * @returns {sap.ui.model.Model} the model instance
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Convenience method for setting the view model in every controller of the application.
		 * @public
		 * @param {sap.ui.model.Model} oModel the model instance
		 * @param {string} sName the model name
		 * @returns {sap.ui.mvc.View} the view instance
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Convenience method for getting the resource bundle.
		 * @public
		 * @returns {sap.base.i18n.ResourceBundle|Promise<sap.base.i18n.ResourceBundle>} the resourceBundle of the component
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * {@link #getResourceText} の引数のコールバック関数の型
		 *
		 * @callback getResourceTextCallback
		 * @param {string} text リソースバンドルから取得した文字列
		 */
		/**
		 * i18n リソースバンドルからテキストを取得する。
		 * @example
		 * // リソースバンドルの設定が同期の場合
		 * MessageToast.show(this.getResourceText("textKey", "placeholder1", "placeholder2"));
		 * // リソースバンドルの設定が非同期の場合
		 * this.getResourceText((text) => MessageToast.show(text), "textKey", "placeholder1", "placeholder2");
		 * @public
		 * @param {string|getResourceTextCallback} vKeyOrCallback - リソースバンドルの設定が同期の場合：キー文字列、非同期の場合：コールバック関数
		 * @param {string} [sFirstArgOrKey] - リソースバンドルの設定が同期の場合：1つ目のプレースホルダ文字列、非同期の場合：キー文字列
		 * @param {...string} [aArgs] - リソースバンドルの設定が同期の場合：2つ目以降のプレースホルダ文字列、非同期の場合：1つ目以降のプレースホルダ文字列
		 * @returns {string|void} リソースバンドルの設定が同期の場合：取得した文字列、非同期の場合：なし
		 */
		getResourceText: function (vKeyOrCallback, sFirstArgOrKey, ...aArgs) {
			const oResourceBundle = this.getResourceBundle();
			if (Object.prototype.toString.call(oResourceBundle).slice(8, -1).toLowerCase() === "promise") {
				oResourceBundle.then((oResource) => vKeyOrCallback(oResource.getText(sFirstArgOrKey, aArgs)));
			} else {
				return oResourceBundle.getText(vKeyOrCallback, [sFirstArgOrKey].concat(aArgs));
			}
		},

		/**
		 * Method for navigation to specific view
		 * @public
		 * @param {string} psTarget Parameter containing the string for the target navigation
		 * @param {mapping} pmParameters? Parameters for navigation
		 * @param {boolean} pbReplace? Defines if the hash should be replaced (no browser history entry) or set (browser history entry)
		 */
		navTo: function (psTarget, pmParameters, pbReplace) {
			this.getRouter().navTo(psTarget, pmParameters, pbReplace);
		},

		getRouter: function () {
			return UIComponent.getRouterFor(this);
		},

		onNavBack: function () {
			const sPreviousHash = History.getInstance().getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.back();
			} else {
				this.getRouter().navTo("appHome", {}, true /*no history*/);
			}
		},

		submitChanges: function (oODataV2Model, mParameters) {
			return new Promise((resolve, reject) => {
				const oParam = { ...mParameters };
				oParam.success = oResponse => {
					const aStatusCodes = this._getBatchResponseStatusCodes(oResponse);
					const bIsSuccess = aStatusCodes.every(iStatusCode => iStatusCode.substring(0, 1) === "2");
					if (bIsSuccess) {
						return resolve(oResponse);
					}

					// 楽観的排他制御エラー
					const bIsConcurrentModificationError = aStatusCodes.some(iStatusCode => iStatusCode === "412");

					// https://sapui5.hana.ondemand.com/#/topic/b4f12660538147f8839b05cb03f1d478 のサンプルコードおよび
					// When the OData service reports errors while writing data, the OData Model adds them to the MessageModel as technical messages.
					// という記述から、ODataMessageParser は ODataレスポンスがエラーの場合は MessageModel の "/" パスに technical メッセージとしてエラーメッセージをセットする仕様の模様。
					// （なお、エラーメッセージは JSON.parse(oData.__batchResponses[].__changeResponses[].response.body).error.message.value でも取得可能）
					// ドキュメント https://sapui5.hana.ondemand.com/#/topic/81c735e69d354de98b0bd139e4bd4e10 をみても、MessageManager からエラーメッセージを取得するのが
					// 標準のやり方のようなので、MessageManager から取得する。
					const aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/");
					const aODataErrorMessages = [];
					if (aMessages) {
						if (Array.isArray(aMessages)) {
							Array.prototype.push.apply(aODataErrorMessages, aMessages.filter(
								oMessage => BaseObject.isA(oMessage, "sap.ui.core.message.Message")
									&& oMessage.getTechnical()
									&& !oMessage.getPersistent()
							));
						} else if (BaseObject.isA(aMessages, "sap.ui.core.message.Message")
							&& aMessages.getTechnical()
							&& !aMessages.getPersistent()) {
							// ここに入ることがあるのかは不明だが、API仕様上は配列とは限らないので念のため
							aODataErrorMessages.push(aMessages);
						}
					}
					if (bIsConcurrentModificationError) {
						this._showConcurrentModificationErrorMessageDialog(oODataV2Model);
					} else if (aODataErrorMessages.length > 0) {
						reject(aODataErrorMessages.map(oMessage => oMessage.getMessage()), aODataErrorMessages, oResponse);
					} else {
						reject([this.getResourceText("base.message.oDataGeneralError")], aODataErrorMessages, oResponse);
					}
				};
				oParam.error = oError => {
					reject([this.getResourceText("base.message.oDataGeneralError")], new Message({
						message: oError.message
					}));
				};
				oODataV2Model.submitChanges(oParam);
			});
		},

		_showConcurrentModificationErrorMessageDialog: function (oODataV2Model) {
			const oMessageView = new MessageView({
				showDetailsPageHeader: false,
				itemSelect: function () {
					oBackButton.setVisible(true);
				},
				items: new MessageItem({
					title: this.getResourceText("base.message.concurrentModification")
				})
			});
			const oBackButton = new Button({
				icon: IconPool.getIconURI("nav-back"),
				press: function () {
					oMessageView.navigateBack();
					this.setVisible(false);
				}
			});

			const oDialog = new Dialog({
				draggable: true,
				content: oMessageView,
				state: ValueState.Error,
				beginButton: new Button({
					text: this.getResourceText("base.button.refresh"),
					type: ButtonType.Emphasized,
					press: function () {
						oODataV2Model.refresh();
						this.getParent().close();
					},
				}),
				endButton: new Button({
					text: this.getResourceText("base.button.cancel"),
					press: function () {
						this.getParent().close();
					}
				}),
				customHeader: new Bar({
					contentLeft: oBackButton,
					contentMiddle: new Text({ text: this.getResourceText("base.title.messages") })
				}),
				contentHeight: "400px",
				contentWidth: "460px",
				verticalScrolling: false
			});
			oMessageView.navigateBack();
			oDialog.open();
		},

		_getBatchResponseStatusCodes: function (oResponse) {
			const aResults = [];
			if (!oResponse || !oResponse.__batchResponses) {
				return aResults;
			}
			const aBatchResponses = oResponse.__batchResponses;
			const iBatchResponsesLength = aBatchResponses.length;
			for (let i = 0; i < iBatchResponsesLength; i++) {
				if (!aBatchResponses[i].__changeResponses) {
					continue;
				}
				let aChangeResponses = aBatchResponses[i].__changeResponses;
				for (let j = 0, iChangeResponsesLength = aChangeResponses.length; j < iChangeResponsesLength; j++) {
					if (aChangeResponses[j].statusCode) {
						aResults.push(aChangeResponses[j].statusCode);
					} else if (aChangeResponses[j].response && aChangeResponses[j].response.statusCode) {
						aResults.push(aChangeResponses[j].response.statusCode);
					}
				}
			}
			return aResults;
		}
	});

});
