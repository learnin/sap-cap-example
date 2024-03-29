sap.ui.define([
	"./BaseController"
], function (BaseController) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.NotFound", {

		onInit: function () {
			this.getRouter().getTarget("notFound").attachDisplay(this._onDisplayTarget, this);
		},
		onExit: function () {
			this.getRouter().getTarget("notFound").detachDisplay(this._onDisplayTarget, this);
		},

		// override the parent's onNavBack (inherited from BaseController)
		onNavBack: function () {
			// in some cases we could display a certain target when the back button is pressed
			if (this._oData && this._oData.fromTarget) {
				this.getRouter().getTargets().display(this._oData.fromTarget);
				delete this._oData.fromTarget;
				return;
			}

			// call the parent's onNavBack
			BaseController.prototype.onNavBack.apply(this, arguments);
		},
		_onDisplayTarget: function(oEvent) {
			this._oData = oEvent.getParameter("data");
		}
	});
});
