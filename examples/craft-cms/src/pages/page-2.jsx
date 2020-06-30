"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Gatsby supports TypeScript natively!
var react_1 = require("react");
var gatsby_1 = require("gatsby");
var layout_1 = require("../components/layout");
var seo_1 = require("../components/seo");
var SecondPage = function (props) { return (<layout_1.default>
    <seo_1.default title="Page two"/>
    <h1>Hi from the second page</h1>
    <p>Welcome to page 2 ({props.path})</p>
    <gatsby_1.Link to="/">Go back to the homepage</gatsby_1.Link>
  </layout_1.default>); };
exports.default = SecondPage;
