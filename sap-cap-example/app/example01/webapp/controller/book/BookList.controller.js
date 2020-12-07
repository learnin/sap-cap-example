sap.ui.define([
    "com/example/example01/controller/BaseController",
    "sap/ui/model/Filter",
      "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
      "sap/m/MessageBox"
  ], function(BaseController, Filter, FilterOperator, FilterType, JSONModel, MessageToast, MessageBox) {
    "use strict";
  
    return BaseController.extend("com.example.example01.controller.book.BookList", {
      onInit: function() {
        // ODataモデル（sap.ui.model.odata.v2.ODataModelが使われている）はモデルのjsファイルを書いて定義してそれをnewしてインスタンスを作成するのではなく、
        // manifest.jsonに定義しておくとクラス実装なしでインスタンスを取得可能。
        
        // manifest.jsonのmodels定義からデフォルトモデル（""で定義されているモデル）を取得
        const catalog = this.getOwnerComponent().getModel("catalog");  // デフォルト以外のモデルを取得する際は getModel("xxx")
  
        // ビューのsap.m.Tableはデフォルトではmanifest.jsonのデフォルトモデル（""で定義されているモデル）にバインディングされる。
        // それ以外のモデルにバインディングしたい場合はセットする
        this.setModel(catalog);
  
        // コントローラとビューの両方で利用したい状態を保持するモデルをビューにセット
        this.setModel(new JSONModel({
          busy : false,
          hasUIChanges : false
        }), "appView");
  
              const oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
              const oMessageModelBinding = oMessageModel.bindList("/", undefined, [], new Filter("technical", FilterOperator.EQ, true));
              this.setModel(oMessageModel, "message");
  
              oMessageModelBinding.attachChange(this.onMessageBindingChange, this);
              this._bTechnicalErrors = false;
      },
      // 画面遷移
      onNavToBookListPage: () => {
        this.navTo("bookList");
      },
      onSearch: function() {
        const view = this.getView();
        const filter = new Filter("title", FilterOperator.Contains, view.byId("searchField").getValue());
        view.byId("bookList").getBinding("items").filter(filter, FilterType.Application);
      },
      onResetChanges: function() {
              this.getModel().resetChanges();
              this._bTechnicalErrors = false; // If there were technical errors, cancelling changes resets them.
              this._setUIChanges(false);
      },
      onSave: function() {
        this._setBusy(true); // Lock UI until submitChanges is resolved.
              this.getModel().submitChanges({
          success: (oData) => {
            this._setBusy(false);
            console.log(oData.__batchResponses);
            const bHasError = oData.__batchResponses?.some(function(batchResponse) {
              return batchResponse.__changeResponses?.some(function(changeResponse) {
                return (changeResponse.statusCode === undefined && changeResponse.response?.statusCode?.substring(0, 1) !== "2")
                  || changeResponse.statusCode.substring(0, 1) !== "2";
              });
            });
            if(bHasError) {
              MessageBox.error(this._getText("changesSentErrorMessage"));
            } else {
              MessageToast.show(this._getText("changesSentMessage"));
            }
            this._setUIChanges(false);
          },
          error: (oError) => {
            this._setBusy(false);
            this._setUIChanges(false);
            MessageBox.error(oError.message);
          }
        });
              this._bTechnicalErrors = false; // If there were technical errors, a new save resets them.
      },
      /**
           * Lock UI when changing data in the input controls
           * @param {sap.ui.base.Event} oEvent - Event data
           */
          onInputChange: function(oEvent) {
              if (oEvent.getParameter("escPressed")) {
                  this._setUIChanges();
              } else {
                  this._setUIChanges(true);
              }
      },
      onStockChange: function(oEvent, id) {
        // 文字列型から数値型へ変換（数値型フィールドに文字列型の値のままOData APIに渡すとバックエンドのCDS側でエラーになる）
        // 対応方法は、このようにchangeイベントハンドラで変換するか、保存ボタン押下時の処理でモデルからgetPendingChangesで変更内容を取得して
        // パースして変換してsetPropertyするか
  
        // TODO: バリデーション
        this.getModel().setProperty(`/Books(${id})/stock`, parseInt(oEvent.getParameters().value, 10));
      },
      
      
  
      /**
           * Set hasUIChanges flag in View Model
           * @param {boolean} [hasUIChanges] - set or clear hasUIChanges
           * if hasUIChanges is not set, the hasPendingChanges-function of the OdataV4 model determines the result
           */
          _setUIChanges : function (hasUIChanges) {
              if (this._bTechnicalErrors) {
                  // If there is currently a technical error, then force 'true'.
                  hasUIChanges = true;
              } else if (hasUIChanges === undefined) {
                  hasUIChanges = this.getModel().hasPendingChanges();
              }
              const appViewModel = this.getModel("appView");
              appViewModel.setProperty("/hasUIChanges", hasUIChanges);
      },
      /**
           * Set busy flag in View Model
           * @param {boolean} bIsBusy - set or clear busy
           */
          _setBusy: function(bIsBusy) {
              const oModel = this.getModel("appView");
              oModel.setProperty("/busy", bIsBusy);
      },
      /**
           * Convenience method for retrieving a translatable text.
           * @param {string} sTextId - the ID of the text to be retrieved.
           * @param {Array} [aArgs] - optional array of texts for placeholders.
           * @returns {string} the text belonging to the given ID.
           */
          _getText: function(sTextId, aArgs) {
              return this.getResourceBundle().getText(sTextId, aArgs);
          },
    });
  });
  