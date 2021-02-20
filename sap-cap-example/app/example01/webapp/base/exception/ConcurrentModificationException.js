sap.ui.define([
	"./BaseException"
], function (BaseException) {
	"use strict";

	/**
	 * 排他制御例外クラス
	 *
	 * @param {string} message メッセージ
	 * @param {Object} [mParameters] パラメータ
	 * @alias base.exception.ODataException
	 * @class
	 * @public
	 */
	const ConcurrentModificationException = function (message, mParameters) {
		this.name = "ConcurrentModificationException";
		this.message = message;

		if (mParameters) {
			this.messages = mParameters.messages;
			this.response = mParameters.response;
		}
		if (!this.messages) {
			this.messages = [];
		}
	};

	ConcurrentModificationException.prototype = Object.create(BaseException.prototype);

	ConcurrentModificationException.prototype.getMessageStrings = function () {
		return this.messages.map(oMessage => oMessage.getMessage());
	}
	return ConcurrentModificationException;
});
