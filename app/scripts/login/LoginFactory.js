/* jshint bitwise: false, camelcase: false, curly: true, eqeqeq: true, globals: false, freeze: true, immed: true, nocomma: true, newcap: true, noempty: true, nonbsp: true, nonew: true, quotmark: double, undef: true, unused: true, strict: true, latedef: nofunc */

/* globals angular */

/**
 * @ngdoc function
 * @name TracsClient.factories:LoginFactory
 * @description
 * Factory para el manejo del usuario logueado
 * Administra el usuario de la sesión en el localStorage
 * comunicándose con Google y el servidor
 */

(function () {
    "use strict";

    angular
        .module("TracsClient.factories")
        .factory("LoginFactory", LoginFactory);

    LoginFactory.$inject = ["$http", "$q", "localStorageService", "ServerUrl"];

    function LoginFactory($http, $q, localStorageService, ServerUrl) {

        var service = {
            login: login
        };

        return service;

        /**
         * Llama al servidor para recuperar un usuario completo a partir de los datos del perfil de G+
         * @param   {object}   googleProfile el perfil del usuario en G+
         * @param   {object}   tokens        un objeto con los tokens access y refresh
         * @returns {promise}  una promesa con el usuario completo
         */
        function getFulfilledUser(googleProfile, tokens) {
            return $http.get(ServerUrl + "/session/login", { params: {
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    googleId: googleProfile.sub,
                    picture: googleProfile.picture,
                    name: googleProfile.name,
                    email: googleProfile.email
                }
            }).then(function (user) {
                return user;
            });
        }

        /**
         * Realiza una invocación a la API de G+ para recuperar el perfil del usuario
         * @param   {string}  accessToken el token de acceso para llamar a la API
         * @returns {promise} una promesa con el perfil del usuario en G+
         */
        function getGoogleUserProfile(accessToken) {
            return $http({
                url: "https://www.googleapis.com/oauth2/v3/userinfo",
                method: "GET",
                params: {
                    access_token: accessToken
                }
            }).then(function (googleProfile) {
                return googleProfile.data;
            });
        }

        /**
         * Utiliza la API OAuth de Google para obtener 1 access token y 1 refresh token a cambio de un código de autorización
         * @param   {string} authorizationCode  el código de autorización obtenido cuando el usuario aceptó el acceso
         * @param   {object} googleOauthOptions el objeto con los parámetros de acceso a OAuth
         * @returns {promise} una promesa con los tokens
         */
        function tradeCodeForTokens(authorizationCode, googleOauthOptions) {
            return $http({
                url: "https://www.googleapis.com/oauth2/v3/token",
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                params: {
                    code: authorizationCode,
                    redirect_uri: googleOauthOptions.redirectUri,
                    client_id: googleOauthOptions.clientId,
                    client_secret: googleOauthOptions.clientSecret,
                    scope: "",
                    grant_type: "authorization_code"
                }
            }).then(function (result) {
                return result.data;
            });
        }

        /**
         * Loguea un usuario en la aplicación, utilizando la API OAuth de Google y el servidor
         * @param   {object}  googleOauthOptions el objeto con los parámetros de acceso a OAuth
         * @returns {promise} una promesa con todos los datos del usuario logueado
         */
        function login(googleOauthOptions) {

            return $q(function (resolve, reject) {
                var authUrl = "https://accounts.google.com/o/oauth2/auth?" +
                    "redirect_uri=" + googleOauthOptions.redirectUri +
                    "&response_type=code" +
                    "&client_id=" + googleOauthOptions.clientId +
                    "&scope=" + googleOauthOptions.scopes +
                    "&approval_prompt=force" +
                    "&access_type=offline";

                // Abre la ventana de autorización
                var authWindow = window.open(authUrl, "_blank", "location=no,toolbar=no");

                // Agrega un evento para escuchar cada vez que cambia la página
                // y capturar el código de autorización cuando hace el callback
                authWindow.addEventListener("loadstart", function (event) {
                    var url = event.url,
                        responseCode = /\?code=(.+)$/.exec(url),
                        responseError = /\?error=(.+)$/.exec(url);

                    // Ya sea por okey o por error, cierra la ventana activa de autorización
                    if (responseCode || responseError) {
                        authWindow.close();
                    }

                    // Si se pudo recuperar el código de autorización correctamente
                    if (responseCode) {
                        // Obtiene un código de acceso a través de la API OAuth de Google
                        var authorizationCode = responseCode[1];

                        // Cambia el código de autorización por 1 access y 1 refresh token
                        return tradeCodeForTokens(authorizationCode, googleOauthOptions).then(function (tokens) {

                            // Recupera la información del perfil del usuario
                            return getGoogleUserProfile(tokens.access_token).then(function (googleProfile) {

                                // Con los datos de Google busca en el servidor el usuario completo, con sus perfiles etc
                                return getFulfilledUser(googleProfile, tokens).then(function (fulfilledUser) {
                                    console.log("Vuelta del server", fulfilledUser);
                                    // Guarda el usuario en el localStorage
                                    localStorageService.set("user", fulfilledUser);

                                    console.log("$$$ Usuario del local storage", localStorageService.get("user"));

                                    return fulfilledUser;
                                });
                            }, function (error) {
                                console.log("Error al recuperar el perfil de Google", error);
                            });
                        });
                    } else if (responseError) {
                        // El usuario denegó el acceso a la app
                        reject({
                            error: responseError[1]
                        });
                    }
                });
            });
        }
    }

})();