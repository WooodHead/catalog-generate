// import { take, call, put, select } from 'redux-saga/effects';

import { call, put, select, takeLatest } from 'redux-saga/effects';
import { LOAD_REPOS } from 'containers/App/constants';

import { LOAD_SEARCH_INDEX, LOAD_SEARCH_RESULTS, UPDATE_SORT, LOAD_FACETS } from './constants';
import { searchIndexLoaded, searchResultsLoaded, searchResultsError, actionsearchResultsTotal, actionFacetsLoaded, actionFacetResultsLoaded } from './actions';

import request from 'utils/request';
import { makeSelectIndex, makeSelectQuery, makeSelectSort, makeSelectFacets, makeSelectResults } from 'containers/SearchPage/selectors';
import elasticlunr from 'elasticlunr';

export function* getFacets() {

  // This breaks staic compilation. Lets fix that later :).
  const url = window.location.href.split('/')[0] + '//' + window.location.href.split('/')[2];
  const requestURL = url + '/schema.json';
  try {
    // Call our request helper (see 'utils/request')
    const currentSchema = yield call(request, requestURL);

    yield put(actionFacetsLoaded(currentSchema.facets));
    return currentSchema.facets;
  } catch (err) {
    console.log("error?", err);
    yield put(searchResultsError(err));
    return null;
  }
}

export function* sortResults(action) {
    const results = yield select(makeSelectResults());
    const sort = yield select(makeSelectSort());
    const query = yield select(makeSelectQuery());
    // Just temp until we have dates.
    if (!query) {
        yield put(searchResultsLoaded(results));
        return;
    }

    switch (sort) {
        case "relevance":
          const relaItems = relatize(results);
          yield put(searchResultsLoaded(relaItems));
          return;
        case "alpha":
          const alphaItems = alphabetize(results);
          yield put(searchResultsLoaded(alphaItems));
          break;
        case "date":
          const dateItems = datetize(results);
          yield put(searchResultsLoaded(dateItems));
          return;
    }
}


Object.filter = (obj, predicate) =>
  Object.keys(obj)
    .filter( key => predicate(obj[key]) )
    .reduce( (res, key) => (res[key] = obj[key], res), {} );



/**
 * Get Search results.
 */
export function* loadIndex() {
  const url = window.location.origin + '/search-index.json';
  console.time("Loading index.");
  let index = yield call(request, url);
  index = elasticlunr.Index.load(index);
  yield put(searchIndexLoaded(index));
  console.timeEnd("Index Loaded");
  return index;
}

/**
 * Get Search results.
 */
export function* loadFacetsFromResults() {
  const facets = yield select(makeSelectFacets());
  const results = yield select(makeSelectResults());
  yield put(actionFacetResultsLoaded(loadFacets(facets, results)))
}

function loadFacets(facets, faceted) {
  const pageSizeFacets = 15;

  let facetsTotal = [];

  facets.forEach(function(facet) {
    facetsTotal[facet] = [];

    faceted.forEach(function(i) {
      if (typeof i.doc[facet] != "undefined") {
        i.doc[facet].forEach(function(t) {
          facetsTotal[facet].push(t);
        });
      }
    });
  });

  var facetsResults = {};

  facets.forEach(function(facet) {
    facetsResults[facet] = {};
    facetsTotal[facet].forEach(function(i) {
        facetsResults[facet][i] = (facetsResults[facet][i]||0)+1;
    });
  });

  //TODO: save facetsResults.

  // TODO: separate into func.
  let facetsSorted = {};
  facets.forEach(function(facet) {
    facetsSorted[facet] = [];
    facetsSorted[facet] = Object.entries(facetsResults[facet]).sort(function(a,b) {
      return (a[1] > b[1]) ? -1 : ((b[1] > a[1]) ? 1 : 0)
    });
  });

  // TODO:
  let facetsPaged = {};
  facets.forEach(function(facet) {
    facetsPaged[facet] = facetsSorted[facet].slice(0, pageSizeFacets);
  });
  return facetsPaged;

}

/**
 * Get Search results.
 */
export function* getResults(action) {

  var query = action.query;// yield select(makeSelectQuery());
  var index = yield select(makeSelectIndex());
  const selectedFacets = action.selectedFacets;

  const sort = yield select(makeSelectSort());
  const pageSize = 25;
  const currentPage = 0; // yield select(makeSelectCurrentPage());
  try {
    if (!index) {
      index = yield call(loadIndex)

    }

    var items = [];

    console.time("Querying index.");

    if (query) {
      items = index.search(query, {expand: true});
    }
    else {
        const docs = index.documentStore.docs;
        items = Object.keys(docs).map(function(index) {
            var item = {
                doc: docs[index],
                ref: index,
                score: 1
            }
            return item;
        });
        // Alphabetical by default if there is no query.
        items = alphabetize(items);
    }
    console.timeEnd("Query Loaded");

    let faceted = [];

    if (selectedFacets) {
      selectedFacets.forEach(function(selectedFacet) {
        faceted = items.filter(function(item) {
          if (item.doc[selectedFacet[0]] !== undefined) {
            var evalItem = Object.filter(item.doc[selectedFacet[0]], facet => facet == selectedFacet[1]);
            if (Object.keys(evalItem).length !== 0) {
              return true;
            }
            else {
              return false;
            }
          }
        });
      })
    }
    else {
      faceted = items;
    }

    yield put(actionsearchResultsTotal(faceted.length));

    const paged = faceted.slice(0, pageSize);

    yield put(searchResultsLoaded(paged));

    const facets = yield getFacets();

    if (facets) {
        yield put(actionFacetResultsLoaded(loadFacets(facets, faceted)))
    }

  } catch (err) {
    console.log("error?", err);
    yield put(searchResultsError(err));
  }
}

function relatize(items) {
    return items.sort(relatCompare);
}

function datetize(items) {
    return items.sort(dateCompare);
}

function alphabetize(items) {
    return items.sort(alphaCompare);
}

function relatCompare(a,b) {
  if (a.score < b.score)
    return -1;
  if (a.score > b.score)
    return 1;
  return 0;
}

function alphaCompare(a,b) {
  if (a.doc.modified < b.doc.modified)
    return -1;
  if (a.doc.modified > b.doc.modified)
    return 1;
  return 0;
}

function alphaCompare(a,b) {
  if (a.doc.title < b.doc.title)
    return -1;
  if (a.doc.title > b.doc.title)
    return 1;
  return 0;
}

/**
 * Root saga manages watcher lifecycle
 */
export default function* searchData() {

  // Watches for LOAD_REPOS actions and calls getRepos when one comes in.
  // By using `takeLatest` only the result of the latest API call is applied.
  // It returns task descriptor (just like fork) so we can continue execution
  // It will be cancelled automatically on component unmount
  yield takeLatest(LOAD_SEARCH_RESULTS, getResults);
  yield takeLatest(UPDATE_SORT, sortResults);
  yield takeLatest(LOAD_FACETS, getFacets);
//  yield takeLatest(LOAD_FACETS, loadFacetsFromResults);
  yield takeLatest(LOAD_SEARCH_INDEX, loadIndex);


}
