var app = angular.module("Gw2Birthday", ["ngStorage"]);

app.controller("BirthdayController", function($scope, $localStorage, Gw2Service) {
    $scope.dialog = document.querySelector("#apikey-dialog");

    $scope.submitAPIKeyDialog = function() {
        console.log($scope.apikey);
        Gw2Service.getTokenInfo($scope.apikey).then(function(res) {
            var hasCharacterPermissions = res.data.permissions.indexOf("characters") > -1;

            if(hasCharacterPermissions) {
                $localStorage.apikey = $scope.apikey;
                $scope.fetchData();
                $scope.dialog.close();
            } else {
                alert("The API key doesn't have permission for the 'characters' endpoint.");
                return;
            }
        }, function(res) {
            alert(res.data.text);
        });
    }

    $scope.birthdaySort = function(character) {
        var now = new Date();
        var birthday = new Date(character.birthday);

        birthday.setFullYear(now.getFullYear());

        // birthday has already passed, add 1 year
        if(now > birthday) {
            birthday.setFullYear(birthday.getFullYear() + 1);
            return birthday;
        }

        return birthday;
    };

    $scope.birthdayInDays = function(character) {
        var now = new Date();
        var birthday = $scope.birthdaySort(character);

        var diff = birthday.getTime() - now.getTime();

        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    $scope.age = function(character) {
        var diffMs = Date.now() - new Date(character.birthday);
        var age = new Date(diffMs);

        return Math.abs(age.getUTCFullYear() - 1970);
    }

    $scope.fetchData = function() {
        var apikey = $scope.apikey;

        Gw2Service.getCharacters(apikey).then(function(res) {
            $scope.characters = [];

            // for every character
            res.data.forEach(function(character) {
                Gw2Service.getCharacter(apikey, character).then(function(res) {
                    var char = {
                        name: res.data.name,
                        birthday: res.data.created,
                        race: res.data.race,
                        profession: res.data.profession,
                        level: res.data.level
                    };

                    $scope.characters.push(char);

                    $localStorage.characters = $scope.characters;
                });
            });
        });
    }

    if(!$localStorage.characters) {
        $localStorage.characters = [];
    }

    $scope.characters = $localStorage.characters;

    if(!$localStorage.apikey) {
        $scope.dialog.showModal();
    } else {
        $scope.apikey = $localStorage.apikey;
        $scope.fetchData();
    }
});

app.factory("Gw2Service", function($http) {
    return {
        getCharacters(apikey) {
            return $http.get("https://api.guildwars2.com/v2/characters?access_token=" + apikey, {
                //headers: {"Authorization": "Bearer " + apikey}
            });
        },

        getCharacter(apikey, characterName) {
            return $http.get("https://api.guildwars2.com/v2/characters/" + characterName + "?access_token=" + apikey, {
                //headers: {"Authorization": "Bearer " + apikey}
            });
        },

        getTokenInfo(apikey) {
            return $http.get("https://api.guildwars2.com/v2/tokeninfo?access_token=" + apikey);
        }
    }
})
