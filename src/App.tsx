import { createMemo, createSignal, For, Show } from "solid-js";

interface DictEntry {
  word: string;
  definitions: string[];
}

const PAGE_SIZE = 90;
function App() {
  const words = createSignal<Record<string, string>>({});
  fetch("/dictionary.json")
    .then((data) => {
      return data.json();
    })
    .then((json) => {
      words[1](json);
    });

  const searchTerm = createSignal("");

  const sortedDictionaryEntriesArray = createMemo(() => {
    return Object.entries(words[0]())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((v) => {
        return {
          word: v[0],
          definitions: v[1].replace(/^1\.\s/, "").split(/\s\d\.\s/),
        };
      });
  });

  const paginatedLetterSections = createMemo(() => {
    const sortedAndConvertedToArray: DictEntry[] =
      sortedDictionaryEntriesArray();

    if (sortedAndConvertedToArray.length) {
      const letterSections: DictEntry[][] = [];

      let letterSection: DictEntry[] = [];

      sortedAndConvertedToArray.forEach((ent) => {
        if (
          !(
            letterSection.length === 0 ||
            ent.word[0] === letterSection[letterSection.length - 1].word[0]
          )
        ) {
          letterSections.push([...letterSection]);
          letterSection = [];
        }
        letterSection.push(ent);
      });

      // Push last
      letterSections.push(letterSection);

      const pages = letterSections.map((section) => {
        const _pages: DictEntry[][] = [];

        let currentPage: DictEntry[] = [];

        section.forEach((ent) => {
          if (currentPage.length > PAGE_SIZE) {
            _pages.push([...currentPage]);
            currentPage = [];
          }

          const needsExactMatch =
            searchTerm[0]().endsWith('"') && searchTerm[0]().startsWith('"');

          const isLengthClose = ent.word.length <= searchTerm[0]().length + 3;

          const searchWord = searchTerm[0]().replaceAll('"', "");

          if (
            searchTerm[0]() === "" ||
            (needsExactMatch
              ? ent.word === searchWord
              : isLengthClose && ent.word.includes(searchWord))
          ) {
            currentPage.push(ent);
          }
        });

        //push last page
        _pages.push(currentPage);

        return _pages;
      });

      return pages;
    }
  });

  const selectedLetter = createSignal("a");

  const selectedPage = createSignal(0);

  const currentLetterSectionPages = createMemo(() => {
    return paginatedLetterSections()?.find(
      (letterSection) => letterSection[0][0]?.word[0] === selectedLetter[0]()
    );
  });

  const currentPageItems = createMemo(() => {
    return currentLetterSectionPages()?.[selectedPage[0]()];
  });

  const letterSectionsThatHaveWords = createMemo(() => {
    return paginatedLetterSections()?.filter((ls) => {
      console.log(ls);
      return !!getLetterOfLetterSection(ls);
    });
  });

  let inp!: HTMLInputElement;

  return (
    <>
      <div class="toolbar">
        <div class="input-container">
          <button
            onClick={() => {
              searchTerm[1]("");
              inp.value = "";
            }}
          >
            <span>✕</span>
          </button>
          <input
            ref={inp}
            placeholder="Search for a word. Enclose word in double quotes to find only definitions for that word."
          />
        </div>
        <button
          onClick={() => {
            const v = inp.value.toLowerCase().trim();
            searchTerm[1](v);
            selectedPage[1](0);
            setTimeout(() => {
              selectedLetter[1](
                letterSectionsThatHaveWords()?.find(
                  (ls) => getLetterOfLetterSection(ls) === v[0]
                )
                  ? v[0]
                  : getLetterOfLetterSection(letterSectionsThatHaveWords()?.[0])
              );
            });
          }}
        >
          <span>Search</span>
        </button>
      </div>
      <div class="letter-tabs">
        <For each={letterSectionsThatHaveWords()}>
          {(letterSection) => {
            const letter = getLetterOfLetterSection(letterSection);
            return (
              <div
                onClick={() => {
                  selectedLetter[1](letter);
                  selectedPage[1](0);
                }}
                class={selectedLetter[0]() === letter ? "active" : ""}
              >
                {letter}
              </div>
            );
          }}
        </For>
      </div>

      <Show
        when={paginatedLetterSections()?.length}
        fallback={
          <div
            style={{
              color: "white",
            }}
          >
            Loading...
          </div>
        }
      >
        <For each={currentPageItems()}>
          {(entry) => {
            return <DefinitionCard entry={entry} />;
          }}
        </For>
      </Show>
      <div class="paginator">
        <button
          disabled={
            selectedPage[0]() === 0 &&
            selectedLetter[0]() ===
              getLetterOfLetterSection(letterSectionsThatHaveWords()?.[0])
          }
          onClick={() => {
            if (selectedPage[0]() === 0) {
              selectedLetter[1]((v) => {
                const indexOfSelected =
                  letterSectionsThatHaveWords()!.findIndex(
                    (ls) => getLetterOfLetterSection(ls) === v
                  );
                return getLetterOfLetterSection(
                  letterSectionsThatHaveWords()![indexOfSelected - 1]
                );
              });

              // Set selectedPage to last page
              selectedPage[1](currentLetterSectionPages()!.length - 1);
            } else {
              selectedPage[1]((v) => --v);
            }
          }}
        >
          <span>◀ Prev</span>
        </button>

        <button
          disabled={
            selectedPage[0]() ===
              (currentLetterSectionPages()?.length || 1) - 1 &&
            selectedLetter[0]() ===
              getLetterOfLetterSection(letterSectionsThatHaveWords()?.at(-1))
          }
          onClick={() => {
            console.log(selectedPage[0](), currentLetterSectionPages());
            if (selectedPage[0]() === currentLetterSectionPages()!.length - 1) {
              selectedLetter[1]((v) => {
                const indexOfSelected =
                  letterSectionsThatHaveWords()!.findIndex(
                    (ls) => getLetterOfLetterSection(ls) === v
                  );
                return getLetterOfLetterSection(
                  letterSectionsThatHaveWords()![indexOfSelected + 1]
                );
              });
              selectedPage[1](0);
            } else {
              selectedPage[1]((v) => ++v);
            }
          }}
        >
          <span>Next ▶</span>
        </button>
      </div>
    </>
  );

  function getLetterOfLetterSection(letterSection: DictEntry[][] | undefined) {
    return letterSection?.[0][0]?.word[0] || "";
  }
}

function DefinitionCard({ entry }: { entry: DictEntry }) {
  return (
    <>
      {" "}
      <div class="definition-card">
        <h2>{entry.word}</h2>
        <ol>
          <For each={entry.definitions}>
            {(definition) => {
              return <li>{definition}</li>;
            }}
          </For>
        </ol>
      </div>
    </>
  );
}
export default App;
