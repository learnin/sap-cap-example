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
	"../exception/ConcurrentModificationException",
	"../exception/ODataException",
	"../model/BaseFormatter"
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
	ConcurrentModificationException,
	ODataException,
	BaseFormatter) {
	"use strict";

	return Controller.extend("fw.controller.BaseController", {

		BaseFormatter: BaseFormatter,

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
		 * @param {string} [sModelName=i18n] the resource bundl model name. default is "i18n".
		 * @returns {sap.base.i18n.ResourceBundle|Promise<sap.base.i18n.ResourceBundle>} the resourceBundle of the component
		 */
		getResourceBundle: function (sModelName = "i18n") {
			return this.getOwnerComponent().getModel(sModelName).getResourceBundle();
		},

		/**
		 * {@link #getResourceText} の引数のコールバック関数の型
		 *
		 * @callback getResourceTextCallback
		 * @param {string} text リソースバンドルから取得した文字列
		 */
		/**
		 * i18n リソースバンドルからテキストを取得する。
		 * 
		 * @example
		 * // リソースバンドルの設定が同期の場合
		 * MessageToast.show(this.getResourceText("textKey", "placeholder1", "placeholder2"));
		 * // リソースバンドルの設定が非同期の場合
		 * this.getResourceText((text) => MessageToast.show(text), "textKey", "placeholder1", "placeholder2");
		 * @public
		 * @param {string|getResourceTextCallback} vKeyOrCallback リソースバンドルの設定が同期の場合：キー文字列、非同期の場合：コールバック関数
		 * @param {string} [sFirstArgOrKey] リソースバンドルの設定が同期の場合：1つ目のプレースホルダ文字列、非同期の場合：キー文字列
		 * @param {...string} [aArgs] リソースバンドルの設定が同期の場合：2つ目以降のプレースホルダ文字列、非同期の場合：1つ目以降のプレースホルダ文字列
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
				const defaultRoute = this.getRouter().getRouteInfoByHash("");
				if (defaultRoute && defaultRoute.name) {
					this.getRouter().navTo(defaultRoute.name, {}, true /*no history*/);
				}
			}
		},

		/**
		 * {@link sap.ui.model.odata.v2.ODataModel ODataModel} の変更をサブミットする。
		 * 
		 * @public
		 * @param {sap.ui.model.odata.v2.ODataModel} oODataV2Model サブミット対象のモデル
		 * @param {Object} mParameter sap.ui.model.odata.v2.ODataModel#submitChanges のパラメータ。ただし、success, error は無視される。
		 * @returns {Promise<Object>|Promise<ODataException>|Promise<ConcurrentModificationException>} Promise 排他制御エラー時は Promise<ConcurrentModificationException>
		 */
		submitChanges: function (oODataV2Model, mParameter) {
			return new Promise((resolve, reject) => {
				const oParam = { ...mParameter };
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
						return reject(
							new ConcurrentModificationException(this.getResourceBundle("fwI18n").getText("fw.message.concurrentModification"), {
								messages: aODataErrorMessages,
								response: oResponse
							}));
					}
					reject(new ODataException(this.getResourceBundle("fwI18n").getText("fw.message.saveError"), {
						messages: aODataErrorMessages,
						response: oResponse
					}));
				};
				oParam.error = oError => {
					reject(
						new ODataException(this.getResourceBundle("fwI18n").getText("fw.message.saveError"), {
							messages: [new Message({
								message: oError.message
							})]
						}));
				};
				oODataV2Model.submitChanges(oParam);
			});
		},

		/**
		 * {@link #submitChanges #submitChanges} のデフォルトエラーハンドラ。
		 * 
		 * @public
		 * @param {Object} oError 例外またはエラー
		 * @param {sap.ui.model.odata.v2.ODataModel} oODataV2Model サブミット対象のモデル
		 * @param {Object} [mParameter] パラメータ。排他制御エラー以外のエラーの場合 mParameter.error(sMessage, sap.ui.core.message.Message[]?) が呼ばれる
		 */
		defaultSubmitChangesErrorHandler: function (oError, oODataV2Model, mParameter) {
			if (oError instanceof ConcurrentModificationException) {
				this.showConcurrentModificationErrorMessageDialog(oODataV2Model);
				return;
			}
			let sMessage = oError.message;
			if (oError instanceof ODataException) {
				if (mParameter && mParameter.error) {
					mParameter.error(sMessage, oError.messages);
					return;
				}
				const aMessages = oError.getMessageStrings();
				if (aMessages.length > 0) {
					sMessage = aMessages.join("\n");
				}
			}
			if (mParameter && mParameter.error) {
				mParameter.error(sMessage);
			} else {
				MessageBox.error(sMessage);
			}
		},

		/**
		 * 排他制御エラー時のメッセージダイアログを表示する。
		 * 
		 * @public
		 * @param {sap.ui.model.odata.v2.ODataModel} oODataV2Model サブミット対象のモデル
		 * @param {Object} [mDialogParameter] sap.m.Dialog のパラメータ
		 */
		showConcurrentModificationErrorMessageDialog: function (oODataV2Model, mDialogParameter) {
			const oMessageView = new MessageView({
				showDetailsPageHeader: false,
				itemSelect: function () {
					oBackButton.setVisible(true);
				},
				items: new MessageItem({
					title: this.getResourceBundle("fwI18n").getText("fw.message.concurrentModification")
				})
			});
			const oBackButton = new Button({
				icon: IconPool.getIconURI("nav-back"),
				press: function () {
					oMessageView.navigateBack();
					this.setVisible(false);
				}
			});

			const oDefaultDialogParam = {
				draggable: true,
				content: oMessageView,
				state: ValueState.Error,
				beginButton: new Button({
					text: this.getResourceBundle("fwI18n").getText("fw.label.refresh"),
					type: ButtonType.Emphasized,
					press: function () {
						oODataV2Model.refresh();
						this.getParent().close();
					},
				}),
				endButton: new Button({
					text: this.getResourceBundle("fwI18n").getText("fw.label.cancel"),
					press: function () {
						this.getParent().close();
					}
				}),
				customHeader: new Bar({
					contentLeft: oBackButton,
					contentMiddle: new Text({ text: this.getResourceBundle("fwI18n").getText("fw.label.messages") })
				}),
				contentHeight: "400px",
				contentWidth: "460px",
				verticalScrolling: false
			};
			const oDialogParam = { ...oDefaultDialogParam, ...mDialogParameter };
			const oDialog = new Dialog(oDialogParam);
			oMessageView.navigateBack();
			oDialog.open();
		},

		/**
		 * バリデーションエラーの有無を返す。
		 * 
		 * @public
		 * @returns {boolean} true: バリデーションエラーがある場合 false: ない場合
		 */
		hasValidationError: function () {
			// https://sapui5.hana.ondemand.com/1.36.6/docs/guide/62b1481d3e084cb49dd30956d183c6a0.html に記載されている通り
			// MessageManager は Singleton であり、そのことと
			// https://github.com/SAP/openui5/blob/0f35245b74ac8eee554292500dfb68af365f1e42/src/sap.ui.core/src/sap/ui/core/message/MessageManager.js
			// の実装を合わせると、#getMessageModel で返される MessageModel も Singleton となっているので、
			// MessageModel をビューにセットしなくても、同じインスタンスを取得可能。
			// ただし、XMLビュー等から参照させる場合はモデルにセットした方が実装しやすい。
			// この BaseController としてはビューへの MessageModel のセットは前提としない（継承先のアプリ側で必要に応じてセットすればよい）。
			return sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/").length > 0;
		},

		/**
		 * バリデーションエラー時のメッセージダイアログを表示する。
		 * 
		 * @public
		 * @param {Object} [mDialogParameter] sap.m.Dialog のパラメータ
		 */
		showValidationErrorMessageDialog: function (mDialogParameter) {
			if (!this.hasValidationError()) {
				return;
			}

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
					contentMiddle: new Text({ text: this.getResourceBundle("fwI18n").getText("fw.label.validationMessages") })
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
					const oControl = sap.ui.getCore().byId(oMessage.getControlId());

					oDialog.close();
					if (oControl) {
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
			oMessageView.setModel(sap.ui.getCore().getMessageManager().getMessageModel());

			oDialog.addContent(oMessageView);
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
					if (aBatchResponses[i].response && aBatchResponses[i].response.statusCode) {
						aResults.push(aBatchResponses[i].response.statusCode);
					} else if (aBatchResponses[i].statusCode) {
						aResults.push(aBatchResponses[i].statusCode);
					}
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
