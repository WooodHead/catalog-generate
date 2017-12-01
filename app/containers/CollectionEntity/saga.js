/**
 * Gets the repositories of the user from Github
 */

import { call, put, select, takeLatest } from 'redux-saga/effects';
import { LOAD_REPOS } from 'containers/App/constants';

import { LOAD_COLLECTION, LOAD_SCHEMA, LOAD_COLLECTION_SUCCESS } from './constants';
import { actionSetCollectionName, collectionLoaded, schemaLoaded } from './actions';

import { reposLoaded, repoLoadingError } from 'containers/App/actions';

import request from 'utils/request';
import {makeSelectCollectionName, makeSelectCollection } from 'containers/CollectionEntity/selectors';

/**
 * Github repos request/response handler
 */
export function* getSchema() {

  // This breaks staic compilation. Lets fix that later :).
  const url = window.location.href.split('/')[0] + '//' + window.location.href.split('/')[2];
  const requestURL = url + '/api/v1/schema.json';
  try {
    // Call our request helper (see 'utils/request')
    const currentSchema = yield call(request, requestURL);
    yield put(schemaLoaded(currentSchema));
  } catch (err) {
    console.log("error?", err);
    yield put(repoLoadingError(err));
  }
}

export function* getDoc(items) {
  const path = items.path;
  const collectionName = path.split('/')[0];
  yield put(actionSetCollectionName(collectionName));
  const url = window.location.origin;
  const requestURL = url + '/api/v1/collections/' + path + '.json';
  try {
    const doc = yield call(request, requestURL);
    yield put(collectionLoaded(doc));
  } catch (err) {
    console.log("error?", err);
    yield put(repoLoadingError(err));
  }
}

/**
 * Root saga manages watcher lifecycle
 */
export default function* githubData() {
  // Watches for LOAD_REPOS actions and calls getRepos when one comes in.
  // By using `takeLatest` only the result of the latest API call is applied.
  // It returns task descriptor (just like fork) so we can continue execution
  // It will be cancelled automatically on component unmount
  yield takeLatest(LOAD_COLLECTION, getDoc);
  yield takeLatest(LOAD_SCHEMA, getSchema);

}
