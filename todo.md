- [x] When I hover on the status column of each row show the difference between the newer and older nonces.
- [x] Increase the font sizes of the smaller text on the UI.
- [x] Create a visible gap between the 2 tables
- [x] Rename "proposal" to "state" on the UI.
- [x] "m3ter_no" column is redundant, retain only one to serve both tables.
- [x] Drop the outer column named "Row".
- [x] Create a sticky navigation tool that scrolls to lines with diffs 1 after the other on click. It should be visible only when "Differences only" is unchecked.
- [x] Remove this "CSV columns: m3ter_no, account, nonce" from those cards.
- [x] Remove the "Removed" counter block.
- [x] The state for "Differences only" should be persistent across reloads probably using localstorage.

New

- [x] Remove the status row. The hover effect should be applicable row wide and should work for only changed rows. It should have 2 lines for transaction diff (nonce diff) and energy diff (account diff)
- [x] Remove this line 'Compared by position · CSV headers are included in exports · Inserted rows can shift subsequent comparisons'
- [x] Make the transaction hash a link to etherscan, add the external link icon to signify it is a link.
- [x] In the line for these cards - Unchanged, Changed, Added, remove Unchanged, add a card for Total Transactions (which would a summation of nonce diffs for each changed row) and Total kWh (which would a summation of account diffs for each changed row).
