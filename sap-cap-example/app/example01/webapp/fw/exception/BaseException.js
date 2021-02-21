sap.ui.define(function () {
    "use strict";

    /**
     * 独自例外の親クラス
     *
     * @param {string} message メッセージ
     * @alias base.exception.BaseException
     */
    const BaseException = function (message) {
        this.name = "BaseException";
        this.message = message;
    };
    return BaseException;
});
