# Sample Application for SAP CAP(Cloud Application Programming Model) Java + SAPUI5 + SAP HANA Cloud 

これは、SAP Cloud Application Programming Model(Java)とSAPUI5とSAP HANA Cloudを使ったサンプルアプリケーションです。

## 環境

- SAP HANA Cloud Trial
- SAP CDS Service 1.11.2
- Spring Boot 2.3.4 RELEASE
- AdoptOpenJDK 11.0.9+11
- Node.js 14.15.1
- @sap/cds-dk 3.3.1

## DB接続設定

プロジェクト直下の `default-env-template.json` をコピーして `default-env.json` ファイルを作成し、接続情報を修正します。  
CDS定義をHANAへ反映させるにはプロジェクト直下で以下のコマンドを実行します。

```shell
cds deploy --to hana --vcap-file ./default-env.json
```

## 起動方法

### バックエンド起動

プロジェクト直下で以下のコマンドを実行します。

```shell
mvn spring-boot:run -Dspring-boot.run.profiles=cloud
```

### フロントエンド起動

プロジェクト直下で以下のコマンドを実行します。

```shell
cd app/example01
npm start
```

## 注意点

- 開発時の利便性のため、Spring SecurityのCSRFチェックを無効化しています(`com.example.sap_cap_example.WebSecurityConfig.java`)
