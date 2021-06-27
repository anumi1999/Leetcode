/**
 * Definition for singly-linked list.
 * struct ListNode {
 *     int val;
 *     ListNode *next;
 *     ListNode() : val(0), next(nullptr) {}
 *     ListNode(int x) : val(x), next(nullptr) {}
 *     ListNode(int x, ListNode *next) : val(x), next(next) {}
 * };
 */
class Solution {
public:
    ListNode* removeNthFromEnd(ListNode* head, int n) {
        int k = n;
        ListNode* end = head;
        while( k-- ){
            end = end->next;
        }
        ListNode* start = head;
        ListNode* prev = NULL;
        while(1){
            if( end == NULL ){
                if( prev == NULL) return start->next;
                prev->next = start->next;
                break;
            }else{
                prev = start;
                start = start->next;
                end = end->next;
            }
        }
        return head;
    }
};
