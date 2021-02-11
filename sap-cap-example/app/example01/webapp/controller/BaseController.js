sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent",
    "com/example/example01/model/formatter"
], function(Controller, History, UIComponent, formatter) {
    "use strict";

    return Controller.extend("com.example.example01.controller.BaseController", {

    formatter: formatter,

    /**
     * Convenience method for getting the view model by name in every controller of the application.
     * @public
     * @param {string} sName the model name
     * @returns {sap.ui.model.Model} the model instance
     */
    getModel: function(sName) {
        return this.getView().getModel(sName);
    },

    /**
     * Convenience method for setting the view model in every controller of the application.
     * @public
     * @param {sap.ui.model.Model} oModel the model instance
     * @param {string} sName the model name
     * @returns {sap.ui.mvc.View} the view instance
     */
    setModel: function(oModel, sName) {
        return this.getView().setModel(oModel, sName);
    },

    /**
     * Convenience method for getting the resource bundle.
     * @public
     * @returns {sap.base.i18n.ResourceBundle|Promise<sap.base.i18n.ResourceBundle>} the resourceBundle of the component
     */
    getResourceBundle: function() {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
    },

    /**
     * i18n リソースバンドルからテキストを取得する。
     * @example
     * // リソースバンドルの設定が同期の場合
     * MessageToast.show(this.getResourceText("textKey", "placeholder1", "placeholder2"));
     * // リソースバンドルの設定が非同期の場合
     * this.getResourceText((text) => MessageToast.show(text), "textKey", "placeholder1", "placeholder2");
     * @public
     * @param {string|function} vKeyOrFn - リソースバンドルの設定が同期の場合：キー文字列、非同期の場合：コールバック関数
     * @param {string} [sFirstArgOrKey] - リソースバンドルの設定が同期の場合：1つ目のプレースホルダ文字列、非同期の場合：キー文字列
     * @param {...string} [aArgs] - リソースバンドルの設定が同期の場合：2つ目以降のプレースホルダ文字列、非同期の場合：1つ目以降のプレースホルダ文字列
     * @returns {string|void} リソースバンドルの設定が同期の場合：取得した文字列、非同期の場合：なし
     */
    getResourceText: function(vKeyOrFn, sFirstArgOrKey, ...aArgs) {
        const oResourceBundle = this.getResourceBundle();
        if (Object.prototype.toString.call(oResourceBundle).slice(8, -1).toLowerCase() === "promise") {
            oResourceBundle.then((oResource) => vKeyOrFn(oResource.getText(sFirstArgOrKey, aArgs)));
        } else {
            return oResourceBundle.getText(vKeyOrFn, [sFirstArgOrKey].concat(aArgs));
        }
    },

    /**
     * Method for navigation to specific view
     * @public
     * @param {string} psTarget Parameter containing the string for the target navigation
     * @param {mapping} pmParameters? Parameters for navigation
     * @param {boolean} pbReplace? Defines if the hash should be replaced (no browser history entry) or set (browser history entry)
     */
    navTo: function(psTarget, pmParameters, pbReplace) {
        this.getRouter().navTo(psTarget, pmParameters, pbReplace);
    },

    getRouter: function() {
        return UIComponent.getRouterFor(this);
    },

    onNavBack: function() {
        const sPreviousHash = History.getInstance().getPreviousHash();

        if (sPreviousHash !== undefined) {
            window.history.back();
        } else {
            this.getRouter().navTo("appHome", {}, true /*no history*/ );
        }
    }

    });

});
