#include<bits/stdc++.h>

using namespace std;

struct ListNode{
    int val;
    ListNode* next;
    ListNode(int x): val(x), next(nullptr) {}
};

bool isCycle(ListNode* head){
    ListNode* slow = head;
    ListNode* fast = head;
    if( !head ){
        return false;
    }else if( !head->next ){
        return false;
    }else{  
        while (fast && fast-> next )
            {
                fast= fast ->next->next; 
                slow = slow -> next;
                if( fast == slow ){
                    return true;
                }
            }
    }
    return false;    
}