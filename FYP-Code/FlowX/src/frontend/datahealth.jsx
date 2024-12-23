import React from 'react';
import Navbar from './navbar';
import styles from '../css/datahealth.module.css'; 

function DataHealth() {
    return (
        <div>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />   
            <div>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia odio vitae vestibulum vestibulum. Cras venenatis euismod malesuada. Nullam ac erat consequat, auctor lectus nec, vehicula sapien. Proin ac nunc eget velit venenatis mollis. Fusce vel mauris metus. Integer at magna a libero facilisis gravida sed quis sapien.</p>
                <p>Pellentesque a ante a quam elementum sollicitudin. Nullam id orci ut sapien consequat accumsan. Ut scelerisque, lectus at aliquam consectetur, risus lorem pellentesque nisi, a luctus purus justo ut justo. Vivamus non eros id felis laoreet congue. Integer nec elit eget odio luctus fermentum sed at dui.</p>
                <p>Curabitur vulputate nunc id velit laoreet, ac posuere lectus interdum. Morbi ut ipsum ac arcu vehicula accumsan. Fusce egestas, magna vitae iaculis fermentum, nunc augue sollicitudin nulla, a lacinia elit turpis non ligula. Donec et risus vehicula, eleifend augue eget, feugiat arcu. Etiam eget justo vitae justo vehicula condimentum.</p>
                <p>Aliquam erat volutpat. Quisque laoreet nisi nec velit feugiat, non dapibus ligula auctor. Vivamus bibendum eros eu tellus dignissim luctus. Nam consequat eros vel elit bibendum, non placerat est blandit. Suspendisse id augue euismod, interdum lorem sed, posuere sem. Proin luctus lectus nec eros lacinia, ut posuere est pretium.</p>
                <p>Sed mollis libero eget magna consequat, vitae vestibulum felis fermentum. Curabitur auctor leo ut ipsum dignissim, nec rhoncus lorem lobortis. Nulla ut felis consectetur, vestibulum elit a, tincidunt lacus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Integer tristique consequat felis, nec tincidunt ligula.</p>
            </div> 
        </div>
    );
}

export default DataHealth;
