#include<bits/stdc++.h>
using namespace std;
vector<int> tab;

int count_stairs(int stairs){
    if( stairs == 1 ){
        return tab[1];
    }else if( stairs == 2){
        return tab[2];
    }else if( tab[stairs] != 0 ){
        return tab[stairs];
    }
    int num_ways_2 = count_stairs(stairs - 2);
    int num_ways_1 = count_stairs(stairs - 1);
    tab[stairs] = num_ways_1 + num_ways_2 ;
    return tab[stairs];
}
int main(){
    int stairs ;
    cin >> stairs;
    tab.resize(stairs + 1 , 0);
    tab[1] = 1;
    tab[2] = 2;
    cout << count_stairs(stairs);
    return 0;
}
