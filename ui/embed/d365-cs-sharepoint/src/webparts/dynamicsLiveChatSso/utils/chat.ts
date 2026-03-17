export const initChatWidgetListener = (existingToken: string | undefined, copilotStudioScope: string): void => {

    // Wait for the Omnichannel Chat Widget to be initialized
    window.addEventListener("lcw:ready", () => {
        console.log("Omnichannel Live Chat Widget is ready. Setting up SSO...");

        // Configure the bot auth token provider for SSO
        (window as any).Microsoft.Omnichannel.LiveChatWidget.SDK.setBotAuthTokenProvider(async (botTokenUrl: string, callback: (arg0: { show: boolean }) => void) => {
            console.log("Bot auth token requested:", botTokenUrl);

            const resourceuri = copilotStudioScope;
            let token = existingToken;

            // If no token from webpart initialization, try to get it now
            if (!token) {
                try {
                    const msal = (window as any).msal;
                    if (msal) {
                        const tokenRequest = {
                            scopes: [resourceuri]
                        };
                        const tokenResponse = await msal.acquireTokenSilent(tokenRequest);
                        token = tokenResponse.accessToken;
                    }
                } catch (err) {
                    console.log("Error getting token:", err);
                }
            }

            console.log("Token available:", token ? "Yes" : "No");

            if (!token) {
                console.warn("No valid token available for authentication");
                callback({ show: true }); // Show sign-in card
                return;
            }

            try {
                // Prepare data to send to bot token URL
                const data = {
                    token: token
                };

                const payload = {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data)
                };

                // Send token to bot for authentication
                console.log("Posting token to bot at:", botTokenUrl);
                const botAuthResponse = await fetch(botTokenUrl, payload);
                console.log("Bot auth response received:", botAuthResponse);

                // Handle response based on status code
                if (botAuthResponse.status === 200) {
                    console.log("Bot authentication successful");
                    callback({ show: false }); // Hide card
                    return;
                } else if (botAuthResponse.status === 404 || botAuthResponse.status === 202) {
                    console.log("Bot authentication card should be shown:", botAuthResponse.status);
                    callback({ show: true }); // Show card
                    return;
                } else {
                    console.warn("Unexpected bot auth response:", botAuthResponse.status);
                    callback({ show: true }); // Show card
                }
            } catch (error) {
                console.error("Error during authentication:", error);
                callback({ show: true });
            }
        });
    });
};

export const renderChatWidget = (
    appId: string,
    lcwVersion: string,
    orgId: string,
    orgUrl: string
): void => {

    const id = 'Microsoft_Omnichannel_LCWidget';
    const src = 'https://oc-cdn-ocprod.azureedge.net/livechatwidget/scripts/LiveChatBootstrapper.js';

    const attributes: Record<string, string> = {
        'data-app-id': appId,
        'data-lcw-version': lcwVersion,
        'data-org-id': orgId,
        'data-org-url': orgUrl,
        'data-customization-callback': 'getChatStyling'
    };
    if (document.getElementById(id)) {
        return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.type = 'text/javascript';

    // Add any additional attributes
    Object.keys(attributes).forEach(key => {
        script.setAttribute(key, attributes[key]);
    });

    document.body.appendChild(script);
};

// Define the styling function in the global scope so the chat widget can access it
(window as any).getChatStyling = (): any => {
    return {
        "styleProps": {
            "generalStyles": {
                "width": "500px",
                "height": "560px",
                "bottom": "20px",
                "right": "20px"
            }
        },
        "headerProps": {
            "styleProps": {
                "generalStyleProps": {
                    "background": "#BD5B00"
                },
                "titleStyleProps": {
                    "color": "#FFFFFF"
                },
                "minimizeButtonStyleProps": {
                    "color": "#FFFFFF"
                },
                "closeButtonStyleProps": {
                    "color": "#FFFFFF"
                }
            },
            "controlProps": {
                "headerTitleProps": {
                    "text": "Chatten?"
                },
                "hideIcon": false,
                "hideTitle": false,
                "headerIconProps": {
                    "src": "https://oc-cdn-ocprod.azureedge.net/livechatwidget/images/OfficeChat.svg",
                    "alt": "Chatten?"
                }
            }
        },
        "webChatContainerProps": {
            "webChatStyles": {
                "bubbleFromUserBackground": "#BD5B00",
                "bubbleFromUserTextColor": "#FFFFFF",
                "bubbleBackground": "#F7EFE5",
                "bubbleTextColor": "#424242",
                "sendBoxBackground": "#FCF8F5",
                "sendBoxTextColor": "#424242",
                "botAvatarBackgroundColor": "#BD5B00",
                "suggestedActionBorderColor": "#BD5B00",
                "suggestedActionTextColor": "#BD5B00"
            },
            "renderingMiddlewareProps": {
                "avatarStyleProps": {
                    "backgroundColor": "#9E6004"
                },
                "avatarTextStyleProps": {
                    "color": "#FFFFFF"
                }
            }
        },
        "loadingPaneProps": {
            "styleProps": {
                "generalStyleProps": {
                    "background": "#BD5B00"
                }
            }
        },
        "chatButtonProps": {
            "styleProps": {
                "iconStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            },
            "controlProps": {
                "titleText": "Chatten?",
                "subtitleText": "We zijn online",
                "avatarUrl": "https://oc-cdn-ocprod.azureedge.net/livechatwidget/images/chatIcon.svg"
            }
        },
        "confirmationPaneProps": {
            "styleProps": {
                "confirmButtonStyleProps": {
                    "backgroundColor": "#BD5B00"
                },
                "confirmButtonFocusedStyleProps": {
                    "backgroundColor": "#BD5B00"
                },
                "confirmButtonHoveredStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            }
        },
        "emailTranscriptPane": {
            "styleProps": {
                "sendButtonStyleProps": {
                    "backgroundColor": "#BD5B00"
                },
                "sendButtonHoveredStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            }
        },
        "postChatLoadingPaneProps": {
            "styleProps": {
                "generalStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            }
        },
        "preChatSurveyPaneProps": {
            "styleProps": {
                "customButtonStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            }
        },
        "proactiveChatPaneProps": {
            "styleProps": {
                "headerContainerStyleProps": {
                    "backgroundColor": "#BD5B00"
                },
                "startButtonStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            }
        },
        "reconnectChatPaneProps": {
            "styleProps": {
                "continueChatButtonStyleProps": {
                    "backgroundColor": "#BD5B00"
                }
            }
        }
    }
};