sap.ui.define([
	"./BaseException"
], function (BaseException) {
	"use strict";

	/**
	 * OData サービス呼び出し時例外クラス
	 *
	 * @param {string} message メッセージ
	 * @param {Object} [mParameters] パラメータ
	 * @alias base.exception.ODataException
	 * @class
	 * @public
	 */
	const ODataException = function (message, mParameters) {
		this.name = "ODataException";
		this.message = message;

		if (mParameters) {
			this.messages = mParameters.messages;
			this.response = mParameters.response;
		}
		if (!this.messages) {
			this.messages = [];
		}
	};

	ODataException.prototype = Object.create(BaseException.prototype);

	ODataException.prototype.getMessageStrings = function () {
		return this.messages.map(oMessage => oMessage.getMessage());
	}
	return ODataException;
});
