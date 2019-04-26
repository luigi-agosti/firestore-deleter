import "jest";
import admin from "firebase-admin";
import firebaseDeleter from "../src";

jest.setTimeout(15000);

let deleter;

beforeAll(async () => {
  admin.initializeApp();
  deleter = new firebaseDeleter(admin.firestore());
  // clean up by deleting everything in the test database
  await deleter.deleteAll();
});

afterEach(async () => {
  // clean up by deleting everything in the test database
  await deleter.deleteAll();
});

it("deleteCollections should delete a specified collection, leaving other collections untouched", async done => {
  const collectionToBeDeletedCollection = admin.firestore().collection("foo");
  const fakeRecordRef = collectionToBeDeletedCollection.doc("cat");
  const collectionToBePreserved = admin.firestore().collection("bar");
  const docToBePreserved = collectionToBePreserved.doc("buzz");

  await docToBePreserved.set({ is_preserved: true });

  await fakeRecordRef.set({ name: "foo", last: "test" });

  const fakeRecordQuerySnaphot = await admin
    .firestore()
    .collection("foo")
    .get();

  expect(fakeRecordQuerySnaphot).toBeTruthy();
  expect(fakeRecordQuerySnaphot.docs.length).toEqual(1);

  await deleter.deleteCollections([collectionToBeDeletedCollection]);
  const deletedFakeRecordQuerySnapshot = await admin
    .firestore()
    .collection("foo")
    .get();

  expect(deletedFakeRecordQuerySnapshot).toBeTruthy();
  expect(deletedFakeRecordQuerySnapshot.docs.length).toEqual(0);

  const docToBePreservedSnapshot = await docToBePreserved.get();
  const { is_preserved } = docToBePreservedSnapshot.data();

  expect(is_preserved).toBe(true);
  // clean up the preserved collection now
  await deleter.deleteCollections([collectionToBePreserved]);
  done();
});

it("deleteCollections should delete a specified collection, along with all subcollections and all subcollection docs", async done => {
  const collection = admin.firestore().collection("foo");
  const collectionDoc = collection.doc("bar");
  const subcollection = collectionDoc.collection("fizz");
  const subcollectionDoc = subcollection.doc("buzz");

  await collectionDoc.set({ collection_doc_exists: true });
  await subcollectionDoc.set({ subcollection_doc_exists: true });

  const collectionQuerySnapshot = await collection.get();
  const [collectionDocSnapshot] = collectionQuerySnapshot.docs;
  const { collection_doc_exists } = collectionDocSnapshot.data();

  expect(collectionQuerySnapshot.docs.length).toEqual(1);
  expect(collection_doc_exists).toBe(true);

  const subCollectionQuerySnapshot = await subcollection.get();
  const [subcollectionSnapshot] = subCollectionQuerySnapshot.docs;
  const { subcollection_doc_exists } = subcollectionSnapshot.data();

  expect(subCollectionQuerySnapshot.docs.length).toEqual(1);
  expect(subcollection_doc_exists).toBe(true);

  await deleter.deleteCollections([collection]);

  const deletedCollection = await collection.get();

  expect(deletedCollection.docs.length).toEqual(0);

  const deletedSubCollection = await subcollection.get();
  expect(deletedSubCollection.docs.length).toEqual(0);

  done();
});

it("deleteAll should delete everything in the database", async done => {
  const collection = admin.firestore().collection("foo");
  const collectionDoc = collection.doc("bar");
  const subcollection = collectionDoc.collection("fizz");
  const subcollectionDoc = subcollection.doc("buzz");

  const secondCollection = admin.firestore().collection("foo");
  const secondCollectionDoc = admin
    .firestore()
    .collection("bear")
    .doc("second");

  await collectionDoc.set({ exists: true });
  await subcollectionDoc.set({ exists: true });
  await secondCollectionDoc.set({ exists: true });

  const collectionQuerySnapshot = await collection.get();
  const subCollectionQuerySnapshot = await subcollection.get();
  const secondCollectionQuerySnapshot = await secondCollection.get();

  expect(collectionQuerySnapshot.docs.length).toEqual(1);
  expect(subCollectionQuerySnapshot.docs.length).toEqual(1);
  expect(secondCollectionQuerySnapshot.docs.length).toEqual(1);

  await deleter.deleteAll();

  const collectionQuerySnapshotDeleted = await collection.get();
  const subCollectionQuerySnapshotDeleted = await subcollection.get();
  const secondCollectionQuerySnapshotDeleted = await secondCollection.get();

  expect(collectionQuerySnapshotDeleted.docs.length).toEqual(0);
  expect(subCollectionQuerySnapshotDeleted.docs.length).toEqual(0);
  expect(secondCollectionQuerySnapshotDeleted.docs.length).toEqual(0);

  done();
});
