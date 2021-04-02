sap.ui.define([
	"sap/base/i18n/ResourceBundle",
	"../fw/validator/Validator"
], function (
	ResourceBundle,
	FwValidator) {
	"use strict";

	class Validator extends FwValidator {
		/**
		 * @constructor
		 * @public
		 * @param {Object} mParameter
		 */
		constructor(mParameter) {
			const oParam = mParameter || {};
			if (!oParam.resourceBundle) {
				oParam.resourceBundle = ResourceBundle.create({
					bundleName: "com.example.example01.i18n.i18n"
				});
			}
			super(oParam);
		}
	}
	return Validator;
});
