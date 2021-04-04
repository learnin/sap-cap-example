sap.ui.define([
	"sap/m/Button",
	"sap/m/ButtonRenderer",
	"sap/m/ButtonType",
	"sap/m/MessageItem",
	"sap/m/MessagePopover",
	"sap/ui/model/BindingMode"
], function (
	Button,
	ButtonRenderer,
	ButtonType,
	MessageItem,
	MessagePopover,
	BindingMode) {
	"use strict";

	/**
	 * {@link sap.m.MessagePopover MessagePopover} 用のボタン
	 * 
	 * @extends sap.m.Button
	 * @constructor
	 * @public
	 */
	return Button.extend("fw.control.MessagePopoverButton", {
		init: function () {
			// ButtonType.Negative は UI5 1.73以降なので、ない場合は ButtonType.Reject で代用する。
			this.setType(ButtonType.Negative || ButtonType.Reject);
			this.setIcon("sap-icon://message-error");

			this.attachPress(this._onPress, this);
		},
		exit: function () {
			this.detachPress(this._onPress, this);

			if (Button.prototype.exit) {
				Button.prototype.exit.apply(this, arguments);
			}
		},
		renderer: ButtonRenderer,
		onBeforeRendering: function () {
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel());

			this.bindProperty("visible", {
				path: "/",
				mode: BindingMode.OneWay,
				formatter: oMessage => oMessage.length > 0
			});
			this.bindProperty("text", {
				path: "/",
				mode: BindingMode.OneWay,
				formatter: oMessage => String(oMessage.length)
			});
		},
		_onPress: function(oEvent) {
			if (!this._oMessagePopover) {
				this._oMessagePopover = this._createMessagePopover();
			}
			this._oMessagePopover.toggle(oEvent.getSource());
		},
		_createMessagePopover: function () {
			const oMessagePopover = new MessagePopover({
				activeTitlePress: oEvent => {
					const oMessage = oEvent.getParameters().item.getBindingContext().getObject();
					const oControl = sap.ui.getCore().byId(oMessage.getControlId());

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
			this.addDependent(oMessagePopover);
			return oMessagePopover;
		}
	});
});
