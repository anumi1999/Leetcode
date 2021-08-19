class Solution {
public:
    ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {
        ListNode* temp= l1 , * temp1 = l2;
        int carry = 0;
        ListNode *ans = new ListNode(0);
        ListNode* temp2 = ans;
        while( temp || temp1 ){
           int x = (temp!=nullptr) ? temp->val : 0;
            int y = (temp1!=nullptr) ? temp1->val : 0;
            int sum = carry + x + y;
            carry = sum / 10;
            ListNode* i = new ListNode( sum%10 );
            temp2->next = i;
            temp2 = temp2->next;
            if( temp != nullptr ) temp = temp->next;
            if( temp1 != nullptr ) temp1 = temp1->next;
        }
        if( carry > 0 ){
            temp2->next = new ListNode(carry);
        }
        
        return ans->next;
    }
};
