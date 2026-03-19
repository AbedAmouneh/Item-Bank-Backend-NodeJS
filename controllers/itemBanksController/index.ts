import { HttpWrapper } from '../../platform/http';
import { deleteItemBank } from './handlers/delete_item_bank';
import { getItemBank } from './handlers/get_item_bank';
import { getItemBanks } from './handlers/get_item_banks';
import { createItemBank } from './handlers/post_item_bank';
import { updateItemBank } from './handlers/put_item_bank';

export async function itemBankRoutes(http: HttpWrapper): Promise<void> {
  await http.get('/item-banks', getItemBanks);
  await http.get('/item-banks/:id', getItemBank);
  await http.post('/item-banks', createItemBank);
  await http.put('/item-banks/:id', updateItemBank);
  await http.delete('/item-banks/:id', deleteItemBank);
}
