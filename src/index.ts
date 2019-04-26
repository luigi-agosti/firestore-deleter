import * as adminType from "firebase-admin";

function getDocPath(
  documentRef:
    | FirebaseFirestore.DocumentReference
    | FirebaseFirestore.CollectionReference,
  overrideTest?: boolean
) {
  const segments = getSegments(
    { segments: documentRef.path.split("/") },
    overrideTest
  );

  return segments.join("/");
}

function getSegments(
  obj: {
    segments: Array<string>;
  },
  overrideTest?: boolean
): Array<string> {
  const { segments } = obj;
  if (
    segments &&
    segments.length > 2 &&
    segments[0] === "__tests" &&
    overrideTest !== true
  ) {
    // Skip the test segments
    return segments.slice(2);
  }
  return segments;
}

function getCollectionOrQueryDepth(
  collectionOrQueryRef:
    | FirebaseFirestore.CollectionReference
    | FirebaseFirestore.Query
) {
  if (collectionOrQueryRef["path"]) {
    return Math.ceil(
      getDocPath(
        collectionOrQueryRef as FirebaseFirestore.CollectionReference
      ).split("/").length / 2
    );
  }
  return 0;
}

export default class FirebaseDeleter {
  _callback;
  _database;
  _pendingCollections;
  _pendingDocuments;
  _pendingPromises;

  constructor(database: adminType.firestore.Firestore) {
    this._database = database;
    this._init();
  }

  _init() {
    this._pendingCollections = [];
    this._pendingDocuments = [];
    this._pendingPromises = [];
  }

  deleteAll() {
    return new Promise(resolve => {
      this._callback = resolve;
      return this._database.getCollections().then(collections => {
        this._init();
        this._pendingCollections = collections;
        this._processNext();
      });
    });
  }

  deleteCollections(collectionRefs: Array<any>) {
    return new Promise(resolve => {
      this._callback = resolve;
      this._init();
      this._pendingCollections = collectionRefs;
      this._processNext();
    });
  }

  _processNext() {
    let promises = [];
    if (this._pendingCollections.length > 0) {
      const collections = this._pendingCollections;
      this._pendingCollections = [];
      promises = collections.map(collectionRef => {
        return this._recurseCollection(collectionRef);
      });
    } else if (this._pendingDocuments.length > 0) {
      // Delete the documents in reverse order, to ensure that child collections
      // are deleted first

      this._pendingDocuments.sort((batchA, batchB) => {
        if (batchA._depth < batchB._depth) {
          return 1;
        }
        if (batchA._depth > batchB._depth) {
          return -1;
        }
        return 0;
      });
      const depth = this._pendingDocuments[0]._depth;
      while (
        this._pendingDocuments.length > 0 &&
        this._pendingDocuments[0]._depth === depth
      ) {
        promises.push(this._pendingDocuments.shift().commit());
      }
    } else if (this._pendingPromises.length > 0) {
      promises = this._pendingPromises;
      this._pendingPromises = [];
    }

    Promise.all(promises)
      .then(() => {
        if (
          this._pendingCollections.length === 0 &&
          this._pendingDocuments.length === 0 &&
          this._pendingPromises.length === 0
        ) {
          this._callback();
        } else {
          process.nextTick(() => {
            this._processNext();
          });
        }
      })
      .catch(err => {
        console.error(": Error deleting firebase objects", err);
      });
  }

  _recurseCollection(collectionRef) {
    return new Promise(resolve => {
      this._deleteQuery(collectionRef, resolve);
    });
  }

  _deleteQuery(collectionRef, resolve) {
    return collectionRef
      .get()
      .then(async snapshot => {
        // When there are no documents left, we are done
        if (snapshot.size === 0) {
          return null;
        }
        const batches = [this._database.batch()];

        // Store the recursive depth of this batch of documents, so we can
        // delete them in order of depth (deepest first) to avoid deleting a
        // parent before a child.  This also allows us to run multiple batch
        // commits in parallel as long as they're at the same depth, which
        // is much faster.
        batches[0]._depth = getCollectionOrQueryDepth(collectionRef);

        let collectionCount = 0;
        const collectionPromises = [];
        snapshot.docs.forEach((doc, idx) => {
          collectionPromises.push(
            doc.ref.getCollections().then(collections => {
              collectionCount += collections.length;
              collections.forEach(collection => {
                this._pendingCollections.push(collection);
              });
            })
          );

          if (idx > 0 && idx % 499 === 0) {
            // this._pendingDocuments.push(batch);
            batches.unshift(this._database.batch());
            batches[0]._depth = Math.ceil(
              getCollectionOrQueryDepth(collectionRef)
            );
          }

          batches[0].delete(doc.ref);
        });

        // Wait until we know if all the documents have collections before deleting them.
        return Promise.all(collectionPromises).then(() => {
          if (collectionCount === 0) {
            batches.forEach(batch =>
              this._pendingPromises.push(batch.commit())
            );
          } else {
            batches.forEach(batch => this._pendingDocuments.push(batch));
          }
        });
      })
      .then(() => {
        resolve();
      });
  }
}
