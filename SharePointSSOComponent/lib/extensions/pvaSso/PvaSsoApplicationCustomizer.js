var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Log } from '@microsoft/sp-core-library';
import { BaseApplicationCustomizer, PlaceholderName } from '@microsoft/sp-application-base';
//import { Dialog } from '@microsoft/sp-dialog';
import * as ReactDOM from "react-dom";
import * as React from "react";
import Chatbot from './components/ChatBot';
import * as strings from 'PvaSsoApplicationCustomizerStrings';
import { override } from '@microsoft/decorators';
var LOG_SOURCE = 'PvaSsoApplicationCustomizer';
/** A Custom Action which can be run during execution of a Client Side Application */
var PvaSsoApplicationCustomizer = /** @class */ (function (_super) {
    __extends(PvaSsoApplicationCustomizer, _super);
    function PvaSsoApplicationCustomizer() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PvaSsoApplicationCustomizer.prototype.onInit = function () {
        Log.info(LOG_SOURCE, "Bot URL ".concat(this.properties.botURL));
        if (!this.properties.buttonLabel || this.properties.buttonLabel === "") {
            this.properties.buttonLabel = strings.DefaultButtonLabel;
        }
        if (!this.properties.botName || this.properties.botName === "") {
            this.properties.botName = strings.DefaultBotName;
        }
        if (this.properties.greet !== true) {
            this.properties.greet = false;
        }
        this.context.placeholderProvider.changedEvent.add(this, this._renderPlaceHolders);
        return Promise.resolve();
    };
    PvaSsoApplicationCustomizer.prototype._renderPlaceHolders = function () {
        // Handling the bottom placeholder
        if (!this._bottomPlaceholder) {
            this._bottomPlaceholder = this.context.placeholderProvider.tryCreateContent(PlaceholderName.Bottom, { onDispose: this._onDispose });
            // The extension should not assume that the expected placeholder is available.
            if (!this._bottomPlaceholder) {
                console.error("The expected placeholder (Bottom) was not found.");
                return;
            }
            var user = this.context.pageContext.user;
            var elem = React.createElement(Chatbot, __assign(__assign({}, this.properties), { userEmail: user.email, userFriendlyName: user.displayName }));
            ReactDOM.render(elem, this._bottomPlaceholder.domElement);
        }
    };
    PvaSsoApplicationCustomizer.prototype._onDispose = function () {
    };
    __decorate([
        override
    ], PvaSsoApplicationCustomizer.prototype, "onInit", null);
    return PvaSsoApplicationCustomizer;
}(BaseApplicationCustomizer));
export default PvaSsoApplicationCustomizer;
//# sourceMappingURL=PvaSsoApplicationCustomizer.js.map