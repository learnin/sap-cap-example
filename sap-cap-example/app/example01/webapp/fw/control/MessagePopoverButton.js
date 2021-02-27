sap.ui.define([
	"sap/m/Button",
	"sap/m/ButtonRenderer",
	"sap/m/ButtonType",
	"sap/m/MessageItem",
	"sap/m/MessagePopover",
	"sap/ui/core/aria/HasPopup",
	"sap/ui/core/Element",
	"sap/ui/model/BindingMode"
], function (
	Button,
	ButtonRenderer,
	ButtonType,
	MessageItem,
	MessagePopover,
	HasPopup,
	Element,
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
		_createMessagePopover: function () {
			const oMessagePopover = new MessagePopover({
				activeTitlePress: oEvent => {
					const oMessage = oEvent.getParameters().item.getBindingContext().getObject();
					let sControlId = oMessage.getControlId();
					if (!sControlId) {
						const aTargets = oMessage.getTargets();
						if (aTargets && aTargets[0]) {
							sControlId = aTargets[0].substring(0, aTargets[0].indexOf("/"));
						}
					}
					const oControl = Element.registry.get(sControlId);

					if (oControl) {
						setTimeout(() => oControl.focus(), 300);
					}
				},
				items: {
					path: "/",
					template: new MessageItem({
						title: "{message}",
						subtitle: "{additionalText}",
						activeTitle: "{= ${controlIds}.length > 0 || !!${target}}",
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
