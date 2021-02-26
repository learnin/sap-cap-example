sap.ui.define([
	"sap/m/Button",
	"sap/m/ButtonRenderer",
	"sap/m/ButtonType",
	"sap/m/MessageItem",
	"sap/m/MessagePopover",
	"sap/ui/core/aria/HasPopup",
	"sap/ui/core/Element",
	"sap/ui/model/BindingMode",
	"sap/ui/model/message/MessageModel"
], function (
	Button,
	ButtonRenderer,
	ButtonType,
	MessageItem,
	MessagePopover,
	HasPopup,
	Element,
	BindingMode,
	MessageModel) {
	"use strict";

	/**
	 * {@link sap.m.MessagePopover MessagePopover} 用のボタン
	 * 
	 * @param {string} [messageModelName] このコントロールをレンダリングするビューにセットされている {@link sap.ui.model.message.MessageModel MessageModel} のモデル名
	 * 
	 * @extends sap.m.Button
	 * @constructor
	 * @public
	 */
	return Button.extend("fw.control.MessagePopoverButton", {
		metadata: {
			properties: {
				/**
				 * このコントロールをレンダリングするビューにセットされている {@link sap.ui.model.message.MessageModel MessageModel} のモデル名。
				 * デフォルトは undefined、つまりデフォルトモデル名。
				 * ただし、デフォルトモデルが {@link sap.ui.model.message.MessageModel MessageModel} でない場合は <code>sap.ui.getCore().getMessageManager().getMessageModel()</code> で取得されるモデルを使用する。
				 * このため通常は指定不要。
				 */
				messageModelName: { type: "string", defaultValue: undefined }
			}
		},
		init: function () {
			this.setType(ButtonType.Negative);
			this.setIcon("sap-icon://message-error");
			this.setAriaHasPopup(HasPopup.Dialog);

			this.attachPress(oEvent => {
				if (!this._oMessagePopover) {
					this._oMessagePopover = this._createMessagePopover();
				}
				this._oMessagePopover.toggle(oEvent.getSource());
			});
		},
		renderer: ButtonRenderer,
		onBeforeRendering: function () {
			if (this.getProperty("messageModelName") === undefined) {
				if (!(this.getModel() instanceof MessageModel)) {
					this.setModel(sap.ui.getCore().getMessageManager().getMessageModel());
				}
			}

			this.bindProperty("visible", {
				model: this.getProperty("messageModelName"),
				path: "/",
				mode: BindingMode.OneWay,
				formatter: oMessage => oMessage.length > 0
			});
			this.bindProperty("text", {
				model: this.getProperty("messageModelName"),
				path: "/",
				mode: BindingMode.OneWay,
				formatter: oMessage => String(oMessage.length)
			});
		},
		_createMessagePopover: function () {
			const oMessagePopover = new MessagePopover({
				activeTitlePress: oEvent => {
					const oMessage = oEvent.getParameters().item.getBindingContext().getObject();
					const oControl = Element.registry.get(oMessage.getControlId());

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
			oMessagePopover.setModel(this.getModel(this.getProperty("messageModelName")));
			this.addDependent(oMessagePopover);
			return oMessagePopover;
		}
	});
});
