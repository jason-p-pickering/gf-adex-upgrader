# Global Fund ADEx Metadata Manager
This app will help you to manage local indicator definitions for GFADEx implementations.

## License
© Copyright 2024 University of Oslo

## Description

The Global Fund may periodically release new and updated versions of the Aggregate Data Exchange (ADEx)
metadata package. You can use this app to help to upgrade your existing indicators to a later version
of the GFADEx metadata, while at the same time maintaining your existing numerator definitions
for your local GFADEx indicators.

## Developing the app

### Install dependencies
To install app dependencies:

```
yarn install
```

### Compile to zip
To compile the app to a .zip file that can be installed in DHIS2:

```
yarn run zip
```

### Start dev server
To start the webpack development server:

```
yarn start
```

By default, webpack will start on port 8081, and assumes DHIS2 is running on
http://localhost:8080/dhis with `admin:district` as the user and password.

A different DHIS2 instance can be used to develop against by adding a `d2auth.json` file like this:

```
{
    "baseUrl": "localhost:9000/dev",
    "username": "john_doe",
    "password": "District1!"
}
```
