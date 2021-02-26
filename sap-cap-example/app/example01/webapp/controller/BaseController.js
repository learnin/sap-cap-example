sap.ui.define([
	"fw/controller/BaseController",
	"../model/formatter"
], function (BaseController, formatter) {
	"use strict";

	return BaseController.extend("com.example.example01.controller.BaseController", {

		formatter: formatter
	});
});
