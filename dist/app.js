let API_CHARACTER_URL = "https://api.guildwars2.com/v2/characters";
let API_ACCOUNT_URL = "https://api.guildwars2.com/v2/account";
let API_TOKENINFO_URL = "https://api.guildwars2.com/v2/tokeninfo";

function accountApiUrl(apiKey) {
    return API_ACCOUNT_URL + "?access_token=" + apiKey;
}

function tokenInfoUrl(apiKey) {
    return API_TOKENINFO_URL + "?access_token=" + apiKey;
}

function characterApiUrl(apikey, characterName) {
    if (!characterName) {
        characterName = "";
    } else {
        characterName = `/${ characterName }`;
    }

    return API_CHARACTER_URL + characterName + "?access_token=" + apikey;
}

function getJSON(url, callback) {
    let request = new XMLHttpRequest();
    request.open("GET", url, true);

    request.onload = () => {
        if (request.status >= 200 && request.status < 400) {
            let data = JSON.parse(request.responseText);

            callback(null, data);
        } else {
            callback({ statusCode: request.status, message: request.responseText }, null);
        }
    };

    request.send();
}

function daysUntil(until) {
    let birthday = new Date(until);
    let now = new Date();

    birthday.setFullYear(now.getFullYear());

    // birthday has already passed, add 1 year
    if (now > birthday) {
        birthday.setFullYear(birthday.getFullYear() + 1);
    }

    let diff = birthday.getTime() - now.getTime();

    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function tryToGet(key, instead) {
    let val = localStorage.getItem(key);

    if (val) {
        return JSON.parse(val);
    }

    return instead;
}

let CharacterEntry = React.createClass({
    displayName: "CharacterEntry",

    nextBirthdayInDays: function () {
        return daysUntil(this.props.data.created);
    },
    characterAge: function () {
        let diffMs = new Date() - new Date(this.props.data.created);
        let age = new Date(diffMs);

        return Math.abs(age.getUTCFullYear() - 1970);
    },
    printBirthday: function () {
        let birthdayInDays = this.nextBirthdayInDays();

        if (birthdayInDays === 365) {
            return `Happy ${ this.characterAge() }. Birthday :)`;
        }

        return `${ this.characterAge() + 1 }. birthday is in ${ birthdayInDays } days.`;
    },
    render: function () {
        return React.createElement(
            "div",
            { className: "character" },
            React.createElement("img", { className: "professionIcon", src: `assets/${ this.props.data.profession }.png` }),
            React.createElement(
                "div",
                { className: "characterName" },
                this.props.data.name
            ),
            React.createElement(
                "div",
                { className: "characterBirthday" },
                this.printBirthday()
            )
        );
    }
});

let CharacterList = React.createClass({
    displayName: "CharacterList",

    getInitialState: function () {
        let characters = tryToGet("characters", []);

        console.log(`found ${ characters.length } cached characters...`);

        return { characters: characters };
    },
    loadData: function () {
        console.log("trying to update character informations...");

        let apikeys = tryToGet("apikeys", []);

        apikeys.forEach(apikey => {
            getJSON(characterApiUrl(apikey), (err, characters) => {
                if (err) {
                    console.error(apikey);
                    console.error(err);
                    return;
                }

                console.log(`found ${ characters.length } characters...`);
                characters.forEach(characterName => this.addCharacter(apikey, characterName));
            });
        });
    },
    addCharacter: function (apikey, characterName) {
        let filtered = this.state.characters.filter(character => character.name === characterName);

        if (filtered.length > 0) {
            return; // character is already known, no need to load it again
        }

        getJSON(characterApiUrl(apikey, characterName), (err, json) => {
            if (err) {
                console.error(err);
                return;
            }

            let characters = this.state.characters;

            let filtered = characters.filter(character => character.name === json.name);

            if (filtered.length > 0) {
                let index = -1;

                for (let i = 0; i < characters.length; i++) {
                    let character = characters[i];

                    if (character.name === json.name) {
                        index = i;
                        break;
                    }
                }

                characters[index] = json;
            } else {
                characters.push(json);
            }

            console.log(`added character: ${ json.name }.`);

            this.setState({ characters: characters });
            localStorage.setItem("characters", JSON.stringify(characters));
        });
    },
    componentDidMount: function () {
        this.loadData();
        setInterval(this.loadData, 5 * 1000); // check for new infos every 5 seconds
    },
    render: function () {
        let sortedCharacters = this.state.characters.sort((a, b) => {
            return daysUntil(a.created) - daysUntil(b.created);
        });

        let characters = sortedCharacters.map(character => {
            return React.createElement(CharacterEntry, { key: character.name, data: character });
        });

        if (characters.length == 0) {
            return React.createElement(
                "div",
                { className: "characterList" },
                React.createElement(
                    "h1",
                    null,
                    "My characters"
                ),
                "No characters found. Sorry :(.",
                React.createElement("br", null),
                React.createElement("img", { src: "https://static.staticwars.com/quaggans/box.jpg", className: "quaggan" })
            );
        }

        return React.createElement(
            "div",
            { className: "characterList" },
            React.createElement(
                "h1",
                null,
                "My characters"
            ),
            characters
        );
    }
});

let APIKeyList = React.createClass({
    displayName: "APIKeyList",

    getInitialState: function () {
        let apikeys = tryToGet("apikeys", []);
        let accounts = tryToGet("accounts", []);

        console.log(`found ${ apikeys.length } api keys...`);

        return { apikeys: apikeys, accounts: accounts };
    },
    loadData: function () {
        this.state.apikeys.forEach(apikey => {
            let filtered = this.state.accounts.filter(account => account.apikey === apikey);

            if (filtered.length > 0) {
                return;
            }

            getJSON(accountApiUrl(apikey), (err, accountInfo) => {
                let valid = true;

                let apikeys = this.state.apikeys;

                if (err) {
                    console.error(err);

                    // invalid key, remove it
                    if (err.statusCode == 400) {
                        apikeys.splice(0, apikeys.indexOf(apikey));
                        this.setState({ apikeys: apikeys });
                        localStorage.setItem("apikeys", JSON.stringify(apikeys));
                    }

                    return;
                }

                getJSON(tokenInfoUrl(apikey), (err, tokenInfo) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    let accounts = this.state.accounts;

                    let perm = tokenInfo.permissions;

                    let newacc = {
                        name: accountInfo.name,
                        apikey: apikey,
                        valid: perm.indexOf("account") > -1 && perm.indexOf("characters") > -1
                    };

                    accounts.push(newacc);

                    this.setState({ accounts: accounts });
                    localStorage.setItem("accounts", JSON.stringify(accounts));
                });
            });
        });
    },
    safeApiKey: function (account) {
        return account.apikey.substring(0, account.apikey.length - 12) + Array(12).join("X");
    },
    onChange: function (e) {
        let text = e.target.value;

        getJSON(accountApiUrl(text), (err, json) => {
            if (!err) {
                console.log(`${ text } is a valid apikey! Add it and clear field...`);

                let filtered = this.state.apikeys.filter(apikey => apikey === text);

                if (filtered == 0) {
                    let apikeys = this.state.apikeys;
                    apikeys.push(text);

                    this.setState({ apikeys: apikeys });
                    localStorage.setItem("apikeys", JSON.stringify(apikeys));
                    this.loadData();
                } else {
                    console.log("Known apikey, just remove it from input...");
                }

                document.getElementById("apikeyInput").value = "";
            }
        });
    },
    componentDidMount: function () {
        this.loadData();
    },
    render: function () {
        let apikeys = this.state.accounts.map(account => React.createElement(
            "div",
            { key: account.apikey, className: "apikeyWrapper" },
            React.createElement(
                "div",
                { className: "accname" },
                account.name
            ),
            React.createElement(
                "div",
                { className: `apikey ${ account.valid ? "valid" : "invalid" }` },
                this.safeApiKey(account)
            )
        ));

        if (apikeys.length == 0) {
            apikeys.push(React.createElement(
                "div",
                { key: new Date().getTime(), className: "apikeyWrapper" },
                React.createElement(
                    "div",
                    { className: "accname" },
                    "No API Keys found..."
                ),
                React.createElement(
                    "div",
                    { className: "apikey" },
                    "Please add one ;)"
                )
            ));
        }

        return React.createElement(
            "div",
            null,
            apikeys,
            React.createElement("input", { id: "apikeyInput", type: "text", placeholder: "Insert API key here...", onChange: this.onChange })
        );
    }
});

ReactDOM.render(React.createElement(APIKeyList, null), document.getElementById("apiKeys"));
ReactDOM.render(React.createElement(CharacterList, null), document.getElementById("characterContainer"));
