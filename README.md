# firestore-deleter

Easily delete firestore collections (along with all of its documents, subcollections, and subcollections), or all data in an entire firestore database.

OBLIGATORY WARNING: Use with caution, this makes deleting lots of data in a firestore database very easy.

The firestore API lacks a way to easily delete collections and subcollections programatically. This package fills this gap, with the following features:

- Supports the ability to delete a single collection, multiple collections, or all collections within a database.
- For each subcollection deleted, all subcollections (and documents) are deleted as well.

This package was developed with running integration tests against a firestore test project in mind and shines in providing a convenient way to clean up test data stored in a firebase test database.

## Installation

This package is intended to be used alongside firebase-admin. Install the necessary packages using either yarn or npm:

```
npm install firestore-deleter
npm install firebase-admin
```

or

```
yarn add firestore-deleter
yarn add firebase-admin
```

## Usage

```
// import firebaseDeleter and firebase-admin
import firebaseDeleter from "firebase-deleter";
import admin from "firebase-admin";

// initialize firebase app
admin.initializeApp();

// create some fake data to delete
const collection = admin.firestore().collection("foo")

const fakeRecordRef = collection.doc("cat");

await fakeRecordRef.set({ name: "foo", last: "test" });

// instantiate an instance of firebaseDeleter
// providing it admin.firestore() as an argument
const deleter = new firebaseDeleter(admin.firestore());

// delete the collection that was just created
// note that deleteCollections expects collectionReferences in array format

await deleter.deleteCollections([collectionToBeDeletedCollection]);

// the collection and all subcollections along with their documents have now been deleted.

// alternatively, nuclear option
// deletes all collections, subcollections, and documents in the firestore database
await deleter.deleteAll()

```

## Testing

This repo includes tests that run against a firestore test database.

In order to run tests, you will need to have a service keys for a firestore database stored in an environment variable.

see https://firebase.google.com/docs/functions/config-env for instructions on configuring a firestore environment.

To run tests, run the following command:

```
yarn test
```
